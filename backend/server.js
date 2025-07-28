require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const Redis = require('redis');
const Joi = require('joi');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'user_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Redis client
const redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis
(async () => {
    await redisClient.connect();
})();

// User validation schema
const userSchema = Joi.object({
    username: Joi.string().required().min(3).max(50),
    mobile: Joi.string().required().pattern(/^[0-9]{10}$/),
    email: Joi.string().required().email().max(100)
});

// Cache middleware
async function checkCache(req, res, next) {
    if (req.method === 'GET') {
        const key = req.originalUrl;
        const data = await redisClient.get(key);
        if (data) {
            return res.json(JSON.parse(data));
        }
    }
    next();
}

// Get all users
app.get('/api/users', checkCache, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        await redisClient.setEx('/api/users', 3600, JSON.stringify(rows));
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
app.get('/api/users/:id', checkCache, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        await redisClient.setEx(`/api/users/${req.params.id}`, 3600, JSON.stringify(rows[0]));
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user
app.post('/api/users', async (req, res) => {
    try {
        const { error } = userSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Check if mobile number or email already exists
        const [existing] = await pool.query('SELECT id FROM users WHERE mobile = ? OR email = ?', 
            [req.body.mobile, req.body.email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Mobile number or email already exists' });
        }

        const [result] = await pool.query(
            'INSERT INTO users (username, mobile, email) VALUES (?, ?, ?)',
            [req.body.username, req.body.mobile, req.body.email]
        );

        await redisClient.del('/api/users');
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { error } = userSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Check if mobile number or email already exists for other users
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE (mobile = ? OR email = ?) AND id != ?', 
            [req.body.mobile, req.body.email, req.params.id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Mobile number or email already exists' });
        }

        const [result] = await pool.query(
            'UPDATE users SET username = ?, mobile = ?, email = ? WHERE id = ?',
            [req.body.username, req.body.mobile, req.body.email, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await redisClient.del('/api/users');
        await redisClient.del(`/api/users/${req.params.id}`);
        res.json({ id: req.params.id, ...req.body });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await redisClient.del('/api/users');
        await redisClient.del(`/api/users/${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});