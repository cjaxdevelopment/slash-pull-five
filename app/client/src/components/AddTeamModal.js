import React, { useState } from 'react';
import { presetColors } from '../utils/presetColors'; // Import shared colors

const AddTeamModal = ({ isOpen, onClose, onAddTeam }) => {
  const [newTeam, setNewTeam] = useState({ name: '', description: '', color: presetColors[0].value });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (newTeam.name && newTeam.description) {
      onAddTeam(newTeam);
      setNewTeam({ name: '', description: '', color: presetColors[0].value });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative z-60">
        <h2 className="text-xl font-bold mb-2">Add New Team</h2>
        <input
          type="text"
          placeholder="Team Name"
          value={newTeam.name}
          onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
          className="border p-2 rounded w-full mb-2"
        />
        <textarea
          placeholder="Description"
          value={newTeam.description}
          onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
          className="border p-2 rounded w-full mb-2"
        />
        <select
          value={newTeam.color}
          onChange={(e) => setNewTeam({ ...newTeam, color: e.target.value })}
          className="border p-2 rounded w-full mb-2"
        >
          {presetColors.map(color => (
            <option key={color.value} value={color.value}>
              {color.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
          >
            Add Team
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTeamModal;
