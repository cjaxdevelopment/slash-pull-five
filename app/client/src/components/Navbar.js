import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faUser } from '@fortawesome/free-solid-svg-icons';

const Navbar = ({ onAddTeamClick, showAddTeamButton = true }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide the navbar options on the login page
  const isLoginPage = location.pathname === '/login';

  return (
    <nav className="bg-gray-800 p-4 text-white">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-5">
          {!isLoginPage && (
            <>
              <Link to="/" className="hover:underline">
                <FontAwesomeIcon icon={faHome} size="lg" />
              </Link>
              {showAddTeamButton && (
                <button
                  onClick={onAddTeamClick}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
                >
                  + Add Team
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center space-x-5">
          {!user && !isLoginPage && (
            <Link to="/login" className="hover:underline">Login</Link>
          )}
          {user && (
            <div className="relative flex items-center space-x-2 group">
              <FontAwesomeIcon
                icon={faUser}
                size="2x"
                className="text-white cursor-pointer"
              />
              <span className="cursor-pointer">{user.username}</span>
              <div className="absolute right-0 mt-12 bg-white text-black rounded shadow-lg hidden group-hover:block z-50">
                <Link to="/profile" className="block px-4 py-2">Profile</Link>
                <button onClick={logout} className="block px-4 py-2 text-left w-full">Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
