import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide the navbar options on the login page
  const isLoginPage = location.pathname === '/login';

  return (
    <nav className="bg-gray-800 p-4 text-white">
      <ul className="flex space-x-4">
        {!isLoginPage && (
          <>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/teams">Teams</Link></li>
            <li><Link to="/players">Players</Link></li>
            <li><Link to="/overview">Teams Overview</Link></li>
          </>
        )}
        {user ? (
          <li className="ml-auto relative group">
            <div className="flex items-center space-x-2 cursor-pointer">
              <img
                src="https://via.placeholder.com/40"
                alt="Profile"
                className="w-8 h-8 rounded-full"
              />
              <span>{user.username}</span>
              <div className="absolute right-0 mt-2 bg-white text-black rounded shadow-lg hidden group-hover:block">
                <Link to="/profile" className="block px-4 py-2">Profile</Link>
                <button onClick={logout} className="block px-4 py-2 text-left w-full">Logout</button>
              </div>
            </div>
          </li>
        ) : (
          !isLoginPage && <li className="ml-auto"><Link to="/login">Login</Link></li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
