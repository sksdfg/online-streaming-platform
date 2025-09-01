Online Streaming Platform

An Online Streaming Platform built with WebRTC for real-time video streaming, backed by a Node.js server, using an SQL database for data storage. The entire application is containerized with Docker and deployed on a local Kubernetes cluster using Minikube.

📑 Table of Contents

Features

Tech Stack
Tech Stack 
Frontend: WebRTC-based streaming client (HTML/JS) 
Backend: Node.js, Express 
Database: SQL (MySQL / PostgreSQL / any SQL of choice) 
Containerization: Docker 
Orchestration: Kubernetes (Minikube)

Architecture

Getting Started

Prerequisites

Setup and Installation

Running the Application

Deployment

Database

API Endpoints

Contributing

License

🚀 Features

Real-time video streaming using WebRTC

User authentication and session management

Stream metadata stored in an SQL database (MySQL/PostgreSQL)

Scalable backend built with Node.js + Express

RESTful API for managing users and streams

Fully containerized with Docker

Deployed and orchestrated with Kubernetes (Minikube)

Easy local development and testing

🛠 Tech Stack

Frontend: WebRTC-based streaming client (HTML5, JavaScript)

Backend: Node.js, Express

Database: MySQL / PostgreSQL (SQL-based)

Containerization: Docker

Orchestration: Kubernetes (Minikube)



WebRTC handles peer-to-peer video streaming.

Node.js server acts as signaling server + REST API backend.

SQL database stores user accounts, session tokens, and stream metadata.

Docker ensures consistent runtime environments.

Kubernetes (Minikube) manages container deployment and scaling.

⚙️ Getting Started
✅ Prerequisites

Make sure you have installed:

Node.js
 (v16+)

Docker

Kubectl

Minikube

MySQL
 or PostgreSQL

📦 Setup and Installation

Clone the repository

git clone https://github.com/your-username/online-streaming-platform.git
cd online-streaming-platform


Install backend dependencies

cd backend
npm install


Configure environment variables
Create a .env file in the backend directory:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=streaming_db
DB_PORT=3306
JWT_SECRET=your_secret_key


Setup database schema

CREATE DATABASE streaming_db;
USE streaming_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE streams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  status ENUM('live', 'ended') DEFAULT 'live',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

▶ Running the Application

Start backend server

npm start


or in development with auto-reload:

npx nodemon server.js


Run frontend (basic HTML/JS with WebRTC signaling)

cd frontend
open index.html


(serve it with a static server if needed).

☸ Deployment (Docker + Kubernetes)

Build Docker images

docker build -t streaming-backend ./backend
docker build -t streaming-frontend ./frontend


Start Minikube

minikube start


Apply Kubernetes manifests

kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/mysql-deployment.yaml


Expose services

kubectl expose deployment backend --type=NodePort --port=3000
kubectl expose deployment frontend --type=NodePort --port=8080


Access services

minikube service frontend

🗄 Database

Users Table → authentication & profile data

Streams Table → stores live/ended streams and metadata

(Optional) Chat Messages Table → if you add real-time chat

📡 API Endpoints
Auth

POST /api/auth/register → Register new user

POST /api/auth/login → Login user (JWT token)

Streams

POST /api/streams/start → Start a new stream

POST /api/streams/end → End a stream

GET /api/streams → List all live streams

GET /api/streams/:id → Get details of a specific stream

Users

GET /api/users/:id → Get user profile
