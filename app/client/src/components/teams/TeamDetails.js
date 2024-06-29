import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../axiosConfig';
import DraggablePlayer from '../players/DraggablePlayer';
import { roleIcons, classIcons, specIcons } from '../../icons';
import { roleOptions, classOptions, specOptions, classRoleOptions } from '../../playerOptions';
import Spinner from '../Spinner'; // Import Spinner component

const TeamDetails = () => {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    role: 'tank',
    class: 'warrior',
    spec: 'arms',
    offspec: 'fury'
  });
  const [availableSpecs, setAvailableSpecs] = useState(specOptions.warrior);
  const [availableRoles, setAvailableRoles] = useState(classRoleOptions.warrior);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamResponse = await axios.get(`/api/teams/${teamId}`);
        setTeam(teamResponse.data);

        const playersResponse = await axios.get(`/api/teams/${teamId}/players`);
        setPlayers(playersResponse.data);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false); // Set loading to false after data is fetched or error occurs
      }
    };

    if (teamId) {
      fetchData();
    }
  }, [teamId]);

  useEffect(() => {
    setAvailableSpecs(specOptions[newPlayer.class]);
    setNewPlayer(prevState => ({
      ...prevState,
      spec: specOptions[newPlayer.class][0].value,
      offspec: specOptions[newPlayer.class][1].value
    }));
    setAvailableRoles(classRoleOptions[newPlayer.class]);
  }, [newPlayer.class]);

  const handleAddPlayer = async () => {
    if (newPlayer.name && newPlayer.role && newPlayer.class && newPlayer.spec && newPlayer.offspec) {
      const player = { ...newPlayer, teamId };
      try {
        const response = await axios.post(`/api/players`, player);
        setPlayers([...players, response.data]);
        setNewPlayer({ name: '', role: 'tank', class: 'warrior', spec: 'arms', offspec: 'fury' });
      } catch (error) {
        console.error('Error adding the player:', error);
      }
    }
  };

  if (loading) {
    return <Spinner />; // Use Spinner component while loading
  }

  if (error) {
    return <div>Error: {error}</div>; // Show error message if an error occurs
  }

  if (!team) {
    return <div>Team not found</div>; // Show team not found if no team data
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white p-4 rounded shadow-md">
        <h1 className="text-3xl font-bold text-center mb-4">{team.name} Details</h1>
        <p className="text-gray-600 mb-4">{team.description}</p>
      </div>
      <div className="bg-white p-4 rounded shadow-md mt-4" style={{ backgroundColor: team.color }}>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Player Name"
            value={newPlayer.name}
            onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
            className="border p-2 mr-2 rounded"
          />
          <select
            value={newPlayer.class}
            onChange={(e) => setNewPlayer({ ...newPlayer, class: e.target.value })}
            className="border p-2 mr-2 rounded"
          >
            {classOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
          <select
            value={newPlayer.role}
            onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}
            className="border p-2 mr-2 rounded"
          >
            {availableRoles.map(role => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={newPlayer.spec}
            onChange={(e) => setNewPlayer({ ...newPlayer, spec: e.target.value })}
            className="border p-2 mr-2 rounded"
          >
            {availableSpecs.map(option => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
          <select
            value={newPlayer.offspec}
            onChange={(e) => setNewPlayer({ ...newPlayer, offspec: e.target.value })}
            className="border p-2 mr-2 rounded"
          >
            {availableSpecs.map(option => (
              <option key={option.value} value={option.value}>
                {option.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddPlayer}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
          >
            Add Player
          </button>
        </div>
        <div className="p-4 rounded bg-gray-100">
          <ul className="space-y-4">
            {players.map(player => (
              <li key={player._id}>
                <DraggablePlayer
                  playerId={player._id}
                  classIcons={classIcons}
                  specIcons={specIcons}
                  roleIcons={roleIcons}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamDetails;
