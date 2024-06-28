import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { addTeam, removeTeam, updateTeam, fetchTeams } from '../../features/teams/teamsSlice';
import axios from '../../axiosConfig';

const presetColors = [
  { name: 'Red', value: '#ff0000' },
  { name: 'Blue', value: '#0000ff' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Purple', value: '#800080' },
  { name: 'Orange', value: '#ffa500' },
  { name: 'Pink', value: '#ffc0cb' },
  { name: 'Gray', value: '#808080' }
];

const Teams = () => {
  const teams = useSelector(state => state.teams.teams);
  const dispatch = useDispatch();
  const [newTeam, setNewTeam] = useState({ name: '', description: '', color: presetColors[0].value });
  const [editingTeam, setEditingTeam] = useState(null);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  const handleAddTeam = async () => {
    if (newTeam.name && newTeam.description) {
      const response = await axios.post('/api/teams', newTeam);
      dispatch(addTeam(response.data));
      setNewTeam({ name: '', description: '', color: presetColors[0].value });
    }
  };

  const handleUpdateTeam = async (id) => {
    if (editingTeam.name && editingTeam.description) {
      await axios.patch(`/api/teams/${id}`, editingTeam);
      dispatch(updateTeam({ id, updates: editingTeam }));
      setEditingTeam(null);
    }
  };

  const handleColorChange = (e, setTeam) => {
    setTeam(prevState => ({
      ...prevState,
      color: e.target.value
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-4">Raid Team Management</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Team Name"
          value={newTeam.name}
          onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
          className="border p-2 mr-2 rounded"
        />
        <input
          type="text"
          placeholder="Description"
          value={newTeam.description}
          onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
          className="border p-2 mr-2 rounded"
        />
        <select
          value={newTeam.color}
          onChange={(e) => handleColorChange(e, setNewTeam)}
          className="border p-2 mr-2 rounded"
        >
          {presetColors.map(color => (
            <option key={color.value} value={color.value}>
              {color.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddTeam}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
        >
          Add Team
        </button>
      </div>
      <ul className="space-y-4">
        {teams.map(team => (
          <li
            key={team._id}
            className="bg-white shadow-md rounded-lg p-4 flex justify-between items-center"
          >
            <div className="flex-1">
              <Link to={`/teams/${team._id}`} className="block mb-2">
                <h2 className="text-xl font-semibold">{team.name}</h2>
                <p className="text-gray-600">{team.description}</p>
              </Link>
              {editingTeam && editingTeam.id === team._id ? (
                <div className="flex flex-col">
                  <input
                    type="text"
                    value={editingTeam.name}
                    onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                    className="border p-2 mr-2 rounded mb-2"
                  />
                  <input
                    type="text"
                    value={editingTeam.description}
                    onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })}
                    className="border p-2 mr-2 rounded mb-2"
                  />
                  <select
                    value={editingTeam.color}
                    onChange={(e) => handleColorChange(e, setEditingTeam)}
                    className="border p-2 mr-2 rounded mb-2"
                  >
                    {presetColors.map(color => (
                      <option key={color.value} value={color.value}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdateTeam(team._id)}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 transition duration-200 mb-2"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTeam(null)}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition duration-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingTeam({ id: team._id, name: team.name, description: team.description, color: team.color })}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-700 transition duration-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => dispatch(removeTeam(team._id))}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-200"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 w-10 h-10 rounded-full" style={{ backgroundColor: team.color }}></div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Teams;
