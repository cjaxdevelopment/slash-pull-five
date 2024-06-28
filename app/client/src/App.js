import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Teams from './components/teams/Teams';
import TeamDetails from './components/teams/TeamDetails';
import TeamsOverview from './components/teams/TeamsOverview';
import Players from './components/players/Players';
import Register from './components/Register';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/:teamId" element={<TeamDetails />} />
            <Route path="/players" element={<Players />} />
            <Route path="/overview" element={<TeamsOverview />} />
          </Route>
        </Routes>
      </AuthProvider>
    </div>
  );
}

export default App;
