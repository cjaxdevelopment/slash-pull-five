import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addTeam, removeTeam, updateTeam } from '../../features/teams/teamsSlice';

const Teams = () => {
  const teams = useSelector(state => state.teams.teams);
  const dispatch = useDispatch();

  const handleAddTeam = () => {
    const newTeam = { id: Date.now(), name: 'New Team', description: 'Description' };
    dispatch(addTeam(newTeam));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-4">Raid Team Management</h1>
      <button
        onClick={handleAddTeam}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200 mb-4"
      >
        Add Team
      </button>
      <ul className="space-y-4">
        {teams.map(team => (
          <li
            key={team.id}
            className="bg-white shadow-md rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <h2 className="text-xl font-semibold">{team.name}</h2>
              <p className="text-gray-600">{team.description}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => dispatch(removeTeam(team.id))}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-200"
              >
                Remove
              </button>
              <button
                onClick={() => dispatch(updateTeam({ id: team.id, updates: { name: 'Updated Team' } }))}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-700 transition duration-200"
              >
                Update
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Teams;
