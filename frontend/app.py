from flask import Flask, render_template, jsonify, request
import requests
import os

app = Flask(__name__)

# Backend API URL for Docker Compose (default)
API_URL = os.getenv('API_URL', 'http://localhost:3000/api')

# Backend API URL for Kubernetes deployment
# When deploying to Kubernetes, set API_URL environment variable to:
# API_URL = 'http://backend-service:3000/api'
# This uses the Kubernetes service name 'backend-service' for service discovery

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/users', methods=['GET'])
def get_users():
    response = requests.get(f'{API_URL}/users')
    return jsonify(response.json()), response.status_code

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    response = requests.get(f'{API_URL}/users/{user_id}')
    return jsonify(response.json()), response.status_code

@app.route('/api/users', methods=['POST'])
def create_user():
    response = requests.post(f'{API_URL}/users', json=request.json)
    return jsonify(response.json()), response.status_code

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    response = requests.put(f'{API_URL}/users/{user_id}', json=request.json)
    return jsonify(response.json()), response.status_code

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    response = requests.delete(f'{API_URL}/users/{user_id}')
    return '', response.status_code

if __name__ == '__main__':
    app.run(port=5000, debug=True)