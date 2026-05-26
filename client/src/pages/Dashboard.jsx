import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import Spinner from '../components/Spinner';
import PortfolioManager from '../components/PortfolioManager';



const Dashboard = () => {
  const { currentUser, loading: authLoading } = useAuth();
  
  if (authLoading) {
    return <Spinner />;
  }
  
  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Portfolio Manager</h1>
      <p className="dashboard-subtitle">Create and manage your mutual fund portfolios</p>
      
      <PortfolioManager />
    </div>
  );
};

export default Dashboard;