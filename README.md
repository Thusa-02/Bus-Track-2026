#  BusTrack — Smart Bus Monitoring & Reporting System

> **Module:** Web Services and Technology (IT2234) · Level 2 IT  
> **Stack:** Node.js · Express.js · MongoDB · React.js (Vite)

---

## Problem Description

Public bus users face daily uncertainty due to:

- No visibility of current bus location or status
- Overcrowded buses with no prior warning
- Difficulty identifying the current stop of a bus
- Lack of real-time communication between passengers
- Inefficient journey planning

These issues lead to wasted time, frustration, and poor transport experience — especially for students and daily commuters on the **Vavuniya ↔ University** route.

---

## Proposed Solution

**BusTrack** is a crowd-powered reporting system that lets users submit live bus updates (current stop + crowd level) instead of relying on expensive GPS hardware.

**Hybrid approach:** Live crowd reports when available → Scheduled timetable as fallback.

---

## Key Features

- **Authentication & Security** — JWT-based register/login, protected routes
- **Bus Management** — Admin CRUD for buses and schedules
- **Live Reporting** — Submit current stop, direction, update type, crowd level
- **Real-Time Tracker** — Latest report with ETA estimate and reliability score
- **Timetable Fallback** — Scheduled trips when no live data exists
- **History Log** — Full audit trail of all submitted updates
- **Review System** — Users can upvote/verify reports for reliability scoring
- **Leaderboard** — Points-based ranking for top contributors
- **Admin Panel** — User management including blocking capabilities
- **Input Validation** — Proper error handling and rate limiting

---

## Technologies Used

|     Layer       | Technology                       |
|-----------------|----------------------------------|
| Backend Runtime | Node.js v20+                     |
| Web Framework   | Express.js                       |
| Database        | MongoDB + Mongoose               |
| Authentication  | JWT + bcrypt                     |
| Security        | Helmet, CORS, express-rate-limit |
| Frontend        | React.js (Vite)                  |
| HTTP Client     | Fetch API (built-in)             |
| API Testing     | Postman                          |
| Version Control | Git & GitHub                     |

---

## API Endpoints

**Base URL:** `http://localhost:5000/api`

### Auth Routes

| Method |     Endpoint     |        Description         |      Auth    |
|--------|------------------|----------------------------|--------------|
| POST   | `/auth/register` | Register new user          | Public       |
| POST   | `/auth/login`    | Login user                 | Public       |
| GET    | `/auth/me`       | Get logged-in user profile | Bearer Token |

---

### Bus Routes

| Method |              Endpoint                       |         Description          | Auth   |
|--------|---------------------------------------------|------------------------------|--------|
| POST   | `/bus/create`                               | Create a new bus             | Admin  |
| GET    | `/bus/getall`                               | Get all buses                | Public |
| PUT    | `/bus/update/:busId`                        | Update bus details           | Admin  |
| DELETE | `/bus/delete/:busId`                        | Delete a bus                 | Admin  |

---

### Schedule Routes

| Method |              Endpoint                  | Description                     | Auth   |
|--------|----------------------------------------|---------------------------------|--------|
| GET    | `/bus/:busId/schedule`                 | Get schedule for a bus          | Public |
| GET    | `/bus/:busId/next-departure`           | Get next departure for a stop   | Public |
| POST   | `/bus/:busId/schedule`                 | Add a schedule trip             | Admin  |
| PUT    | `/bus/:busId/schedule/:tripId`         | Update a schedule trip          | Admin  |
| DELETE | `/bus/:busId/schedule/:tripId`         | Delete a schedule trip          | Admin  |

---

### Update (Live Report) Routes

| Method |              Endpoint              |         Description           |        Auth          |
|--------|------------------------------------|-------------------------------|----------------------|
| POST   | `/update/create`                   | Submit a live bus update      | Bearer Token         |
| GET    | `/update/getall/:busId`            | Get all updates for a bus     | Public               |
| GET    | `/update/latest/:busId`            | Get latest update for a bus   | Public               |
| POST   | `/update/:id/review`               | Review / verify an update     | Bearer Token         |
| PUT    | `/update/update/:id`               | Edit an update report         | Bearer Token         |
| DELETE | `/update/delete/:id`               | Delete an update report       | Bearer Token / Admin |
| GET    | `/update/leaderboard`              | Get top contributors ranking  | Public               |

---

### Admin Panel Routes

| Method |              Endpoint                  | Description        | Auth  |
|--------|----------------------------------------|--------------------|-------|
| GET    | `/admin/users`                         | Get all users      | Admin |
| PUT    | `/admin/users/:userId/block`           | Block a user       | Admin |

---

## API Testing Guide

### User Flow

#### 1. Register User

```
POST http://localhost:5000/api/auth/register
```

```json
{
  "name": "Abby",
  "email": "abby@gmail.com",
  "password": "abby@123"
}
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "token": "JWT_TOKEN"
}
```

---

#### 2. Login User

```
POST http://localhost:5000/api/auth/login
```

```json
{
  "email": "abby@gmail.com",
  "password": "abby@123"
}
```

> Copy the returned token → save as `USER_TOKEN`

---

#### 3. Get Profile

```
GET http://localhost:5000/api/auth/me
Authorization: Bearer USER_TOKEN
```

**Expected Response:**
```json
{
  "_id": "USER_ID",
  "name": "Abby",
  "email": "abby@gmail.com",
  "role": "user"
}
```

---

#### 4. Get All Buses (Public)

```
GET http://localhost:5000/api/bus/getall
```

**Expected Response:**
```json
[
  {
    "_id": "BUS_ID",
    "busNumber": "CTB NE-2304",
    "routeName": "Mannar",
    "status": "active"
  }
]
```

---

#### 5. Get Bus Schedule (Public)

```
GET http://localhost:5000/api/bus/BUS_ID/schedule
```

**Expected Response:**
```json
[
  {
    "_id": "TRIP_ID",
    "direction": "TO_UNIVERSITY",
    "stopTimes": [
      { "stop": "Vavuniya", "time": "08:00" }
    ]
  }
]
```

---

#### 6. Get Next Departure (Public)

```
GET http://localhost:5000/api/bus/BUS_ID/next-departure?direction=TO_UNIVERSITY&stop=Vavuniya
```

**Expected Response:**
```json
{
  "nextDeparture": "08:00",
  "stop": "Vavuniya"
}
```

---

#### 7. Submit Live Update

```
POST http://localhost:5000/api/update/create
Authorization: Bearer USER_TOKEN
```

```json
{
  "busId": "BUS_ID",
  "currentStop": "Vavuniya",
  "direction": "TO_UNIVERSITY",
  "updateType": "spotted",
  "crowdLevel": "standing_only",
  "description": "Bus is near town",
  "deviceId": "device123",
  "reportedBy": "User"
}
```

**Expected:** `201 Created`

|     Field    |                 Valid Values                        |
|--------------|-----------------------------------------------------|
| `direction`  | `TO_UNIVERSITY`, `TO_VAVUNIYA`                      |
| `updateType` | `spotted`, `onboard`                                |
| `crowdLevel` | `seats_available`, `standing_only`, `fully_crowded` |

---

#### 8. Get All Updates (Public)

```
GET http://localhost:5000/api/update/getall/BUS_ID
```

**Expected Response:**
```json
[
  {
    "_id": "UPDATE_ID",
    "currentStop": "Vavuniya",
    "direction": "TO_UNIVERSITY",
    "crowdLevel": "standing_only",
    "reportedBy": "User"
  }
]
```

---

#### 9. Get Latest Update (Public)

```
GET http://localhost:5000/api/update/latest/BUS_ID
```

**Expected Response:**
```json
{
  "_id": "UPDATE_ID",
  "currentStop": "Kurumankadu",
  "crowdLevel": "fully_crowded",
  "reportedBy": "User"
}
```

---

#### 10. Review an Update

```
POST http://localhost:5000/api/update/UPDATE_ID/review
Authorization: Bearer USER_TOKEN
```

```json
{
  "isTrue": true
}
```

**Expected Response:**
```json
{
  "message": "Review added successfully"
}
```

---

#### 11. Edit Own Update

```
PUT http://localhost:5000/api/update/update/UPDATE_ID
Authorization: Bearer USER_TOKEN
```

```json
{
  "currentStop": "Kurumankadu",
  "crowdLevel": "fully_crowded"
}
```

**Expected Response:**
```json
{
  "message": "Update updated successfully"
}
```

---

#### 12. Delete Own Update

```
DELETE http://localhost:5000/api/update/delete/UPDATE_ID
Authorization: Bearer USER_TOKEN
```

**Expected Response:**
```json
{
  "message": "Update deleted successfully"
}
```

---

#### 13. Leaderboard (Public)

```
GET http://localhost:5000/api/update/leaderboard
```

**Expected Response:**
```json
[
  {
    "userName": "Abby",
    "points": 20
  }
]
```

---

#### 14. Restricted Actions (Should Fail for Users)

|           Action             |                    Endpoint                       |     Expected    |
|------------------------------|---------------------------------------------------|-----------------|
| Create Bus                   | `POST /api/bus/create` with `USER_TOKEN`          | `403 Forbidden` |
| Update Bus                   | `PUT /api/bus/update/:busId` with `USER_TOKEN`    | `403 Forbidden` |
| Delete Bus                   | `DELETE /api/bus/delete/:busId` with `USER_TOKEN` | `403 Forbidden` |
| Add Schedule                 | `POST /api/bus/:busId/schedule` with `USER_TOKEN` | `403 Forbidden` |
| Delete Another User's Update | `DELETE /api/update/delete/:id` with `USER_TOKEN` | `403 Forbidden` |

---

### Admin Flow

#### 1. Register Admin Account

```
POST http://localhost:5000/api/auth/register
```

```json
{
  "name": "Admin",
  "email": "admin@test.com",
  "password": "123456"
}
```

---

#### 2. Set Admin Role in MongoDB

In the `users` collection, update the document:

```js
db.users.updateOne(
  { email: "admin@test.com" },
  { $set: { role: "admin" } }
)
```

---

#### 3. Login Admin

```
POST http://localhost:5000/api/auth/login
```

```json
{
  "email": "admin@test.com",
  "password": "123456"
}
```

> Copy the returned token → save as `ADMIN_TOKEN`

---

#### 4. Bus Management (Admin Only)

|    Action     |      Method & Endpoint          |                           Body                                                       |
|---------------|---------------------------------|--------------------------------------------------------------------------------------|
| Create Bus    | `POST /api/bus/create`          | `{ "busNumber": "101", "routeName": "Vavuniya - University", "status": "active" }`  |
| Get All Buses | `GET /api/bus/getall`           | —                                                                                    |
| Update Bus    | `PUT /api/bus/update/:busId`    | `{ "routeName": "Updated Route", "status": "inactive" }`                            |
| Delete Bus    | `DELETE /api/bus/delete/:busId` | —                                                                                    |

> All write operations require `Authorization: Bearer ADMIN_TOKEN`

---

#### 5. Schedule Management (Admin Only)

|        Action        |             Method & Endpoint             |
|----------------------|-------------------------------------------|
| Add Schedule Trip    | `POST /api/bus/:busId/schedule`           |
| Get Schedule         | `GET /api/bus/:busId/schedule`            |
| Update Schedule Trip | `PUT /api/bus/:busId/schedule/:tripId`    |
| Delete Schedule Trip | `DELETE /api/bus/:busId/schedule/:tripId` |

**Example — Add Schedule:**

```json
{
  "direction": "TO_UNIVERSITY",
  "stopTimes": [
    { "stop": "Vavuniya",     "time": "08:00" },
    { "stop": "Kurumankadu",  "time": "08:05" },
    { "stop": "Veppangulam",  "time": "08:10" },
    { "stop": "Nelukulam",    "time": "08:15" },
    { "stop": "University",   "time": "08:20" }
  ]
}
```

**Example — Update Schedule:**

```json
{
  "direction": "TO_VAVUNIYA",
  "stopTimes": [
    { "stop": "University", "time": "17:00" },
    { "stop": "Nelukulam",  "time": "17:05" }
  ]
}
```

---

#### 6. Update Control (Admin Power)

|       Action      |          Method & Endpoint            |           Notes              |
|-------------------|---------------------------------------|------------------------------|
| Get All Updates   | `GET /api/update/getall/:busId`       | Public access                |
| Delete Any Update | `DELETE /api/update/delete/:updateId` | Admin can delete any report  |

---

#### 7. Admin Panel — User Management (Admin Only)

**Get All Users:**

```
GET http://localhost:5000/api/admin/users
Authorization: Bearer ADMIN_TOKEN
```

**Expected Response:**
```json
[
  {
    "_id": "USER_ID",
    "name": "Abby",
    "email": "abby@gmail.com",
    "role": "user",
    "blocked": false
  }
]
```

**Block a User:**

```
PUT http://localhost:5000/api/admin/users/USER_ID/block
Authorization: Bearer ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "message": "User blocked successfully"
}
```

---

## ⚙️ Setup Instructions

### Prerequisites

- Node.js v20 or higher
- MongoDB (running locally on port 27017)
- Git (optional)

### 1. Clone or Extract

```bash
# From ZIP
unzip bus.zip && cd bus

# Or clone
git clone <your-repo-url> && cd bus
```

### 2. Configure Environment Variables

Create `.env` in the server root:

```env
PORT=5000
MONGO_URL=mongodb://127.0.0.1:27017/bus
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_here
```

### 3. Configure Frontend Environment

Create `clientFrontEnd/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Run the App

```bash
# Terminal 1 — Backend
cd bus
npm start

# Terminal 2 — Frontend
cd bus/clientFrontEnd
npm run dev
```

- **Backend:** `http://localhost:5000`
- **Frontend:** `http://localhost:3000`

---

## Dependencies Reference

### Core Packages

| # |        Package         |            Command               |                                 Reason                                      |
|---|------------------------|----------------------------------|-----------------------------------------------------------------------------|
| 1 | **Express**            | `npm install express`            | Creates the server and handles API routes (GET, POST, PUT, DELETE)          |
| 2 | **Dotenv**             | `npm install dotenv`             | Loads environment variables from `.env` file (DB URL, JWT secret) securely  |
| 3 | **Mongoose**           | `npm install mongoose`           | Connects Node.js to MongoDB and defines data models (schemas)               |
| 4 | **Body-Parser**        | `npm install body-parser`        | Parses incoming JSON request data so you can access it via `req.body`       |
| 5 | **Bcrypt**             | `npm install bcrypt`             | Hashes user passwords before saving → improves security                     |
| 6 | **JSON Web Token**     | `npm install jsonwebtoken`       | Generates secure tokens after login for authentication                      |
| 7 | **CORS**               | `npm install cors`               | Allows your API to be accessed from different origins (e.g., frontend)      |
| 8 | **Helmet**             | `npm install helmet`             | Adds security headers to protect against common web vulnerabilities         |
| 9 | **Express Rate Limit** | `npm install express-rate-limit` | Prevents spam/brute force attacks by limiting requests                      |

### Dev Dependency

| #  |   Package   |           Command                |                          Reason                               |
|----|-------------|----------------------------------|---------------------------------------------------------------|
| 10 | **Nodemon** | `npm install nodemon --save-dev` | Auto-restarts the server on file changes → faster development |

### Frontend (React + Vite)

| # |   Package    |       Command        |                          Reason                              |
|---|--------------|----------------------|--------------------------------------------------------------|
| 1 | **React App** | `cd clientFrontEnd && npm install` | Installs all frontend dependencies (React, Vite, etc.)  |

---

## How the System Works

1. **Users register and log in** — JWT token issued on successful login
2. **Admin manages buses and schedules** — creates bus entries and timetable trips
3. **Users submit live updates** with current stop and crowd level
4. **Other users review updates** — upvoting builds a reliability score
5. **Users earn points** for submitting reports — visible on the leaderboard
6. **Other users view the latest update** for any bus in real time
7. **If no live updates exist** — the system falls back to showing the scheduled timetable
8. **Admins manage users** — can view all users and block bad actors

---

## Project Structure

```
bus/
├── controller/
│   ├── authController.js
│   ├── busController.js
│   └── updateController.js
├── model/
│   ├── userModel.js
│   ├── busModel.js
│   └── updateModel.js
├── routes/
│   ├── authRoute.js
│   ├── busRoute.js
│   └── updateRoute.js
├── middleware/
│   └── authMiddleware.js
├── constants/
│   └── routeConstants.js
├── index.js
├── .env
└── client/          ← React frontend (Vite)
    └── src/
        ├── App.jsx
        ├── api.js
        └── style.css
```

---

## Academic Information

|    Field        |              Detail                  |
|-----------------|--------------------------------------|
| Module          | Web Services and Technology (IT2234) |
| Level           | 2nd Year IT                          |
| Assignment      | ICA-03 Project                       |
| Registration No | 2022/ICT/121                         |
| Year            | 2026                                 |