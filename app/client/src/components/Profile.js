import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await fetch(`/api/user/${user.userId}`);
      const data = await response.json();
      setUserData(data);
      setUsername(data.username);
    };

    fetchUserData();
  }, [user.userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`/api/users/${user.userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  if (!userData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      {!isEditing ? (
        <div>
          <p><strong>Username:</strong> {userData.username}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
          >
            Edit Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
            <small className="text-gray-600">Leave blank to keep the current password</small>
          </div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Update
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded ml-2"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
};

export default Profile;
