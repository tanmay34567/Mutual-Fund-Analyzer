# Mutual Fund Analyzer - Backend

This is the backend server for the Mutual Fund Analyzer project, built with Node.js, Express, and PostgreSQL.

## Technology Stack

- Node.js with Express
- PostgreSQL with Sequelize ORM
- JWT Authentication
- CORS enabled
- Morgan for logging

## Project Structure

```
server/
├── config/        # Configuration files
├── middleware/    # Express middleware
├── models/        # Sequelize models
├── routes/        # API routes
├── services/      # Business logic
├── utils/         # Utility functions
└── index.js       # Server entry point
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file with the following:
```env
PORT=5000
NODE_ENV=development
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
DB_SSL=true
JWT_SECRET=your-jwt-secret
```

3. Start the development server:
```bash
npm run dev
```

4. Start for production:
```bash
npm start
```

## API Documentation

### Authentication

- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user

### Portfolios

- GET `/api/portfolios` - Get all portfolios
- GET `/api/portfolios/:id` - Get specific portfolio
- POST `/api/portfolios` - Create new portfolio
- PUT `/api/portfolios/:id` - Update portfolio
- DELETE `/api/portfolios/:id` - Delete portfolio

### Analysis

- GET `/api/analyze/portfolio/:id` - Get portfolio analysis
- GET `/api/analyze/compare` - Compare multiple funds

### Mutual Funds

- GET `/api/mutual-funds/search` - Search mutual funds
- GET `/api/mutual-funds/:id` - Get fund details

## Database Models

### User
- id (UUID)
- email (String)
- password (String, hashed)
- name (String)

### Portfolio
- id (UUID)
- userId (UUID, FK)
- name (String)
- description (String)
- createdAt (Date)
- updatedAt (Date)

### MutualFund
- id (UUID)
- schemeCode (String)
- name (String)
- category (String)
- latestNav (Decimal)
- navDate (Date)

### Holding
- id (UUID)
- portfolioId (UUID, FK)
- mutualFundId (UUID, FK)
- units (Decimal)
- investmentDate (Date)
- purchaseNav (Decimal)

## Error Handling

The application uses a centralized error handling middleware that catches all errors and returns appropriate HTTP status codes and error messages.

## Deployment

The backend is deployed on Render. Make sure to set up all environment variables in the deployment platform.
