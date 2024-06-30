import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from '../../axiosConfig';
import { fetchPlayers, addPlayer, removePlayer, updatePlayer } from '../../features/players/playersSlice';
import { classOptions, roleOptions, specOptions, classRoleOptions } from '../../playerOptions';

const Players = () => {
  const players = useSelector(state => state.players.players);
  const dispatch = useDispatch();
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'tank', class: 'warrior', spec: 'arms', offspec: 'fury' });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [availableSpecs, setAvailableSpecs] = useState(specOptions.warrior);
  const [availableRoles, setAvailableRoles] = useState(classRoleOptions.warrior);

  useEffect(() => {
    dispatch(fetchPlayers());
  }, [dispatch]);

  useEffect(() => {
    if (newPlayer.class) {
      setAvailableSpecs(specOptions[newPlayer.class]);
      setAvailableRoles(classRoleOptions[newPlayer.class]);
      setNewPlayer(prevState => ({
        ...prevState,
        spec: specOptions[newPlayer.class][0].value,
        offspec: specOptions[newPlayer.class][1].value,
      }));
    }
  }, [newPlayer.class]);

  const handleAddPlayer = async () => {
    if (newPlayer.name && newPlayer.role && newPlayer.class && newPlayer.spec && newPlayer.offspec) {
      const response = await axios.post('/api/players', newPlayer);
      dispatch(addPlayer(response.data));
      setNewPlayer({ name: '', role: 'tank', class: 'warrior', spec: 'arms', offspec: 'fury' });
    }
  };

  const handleUpdatePlayer = async (id) => {
    if (editingPlayer.name && editingPlayer.role && editingPlayer.class && editingPlayer.spec && editingPlayer.offspec) {
      const response = await axios.patch(`/api/players/${id}`, editingPlayer);
      dispatch(updatePlayer({ id, updates: response.data }));
      setEditingPlayer(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-4">Player Management</h1>
      <div className="mb-4">
        <PlayerForm
          player={newPlayer}
          setPlayer={setNewPlayer}
          availableSpecs={availableSpecs}
          availableRoles={availableRoles}
          handleSubmit={handleAddPlayer}
          buttonText="Add Player"
        />
      </div>
      <ul className="space-y-4">
        {players.map(player => (
          <li key={player._id} className="bg-white shadow-md rounded-lg p-4 flex justify-between items-center">
            {editingPlayer && editingPlayer._id === player._id ? (
              <PlayerForm
                player={editingPlayer}
                setPlayer={setEditingPlayer}
                availableSpecs={availableSpecs}
                availableRoles={availableRoles}
                handleSubmit={() => handleUpdatePlayer(player._id)}
                buttonText="Save"
                cancelEdit={() => setEditingPlayer(null)}
              />
            ) : (
              <PlayerDetails player={player} setEditingPlayer={setEditingPlayer} />
            )}
            <div className="flex space-x-2">
              <button
                onClick={() => dispatch(removePlayer(player._id))}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-200"
              >
                Remove
              </button>
              <button
                onClick={() => setEditingPlayer(player)}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-700 transition duration-200"
              >
                Edit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const PlayerForm = ({ player, setPlayer, availableSpecs, availableRoles, handleSubmit, buttonText, cancelEdit }) => (
  <div>
    <input
      type="text"
      placeholder="Player Name"
      value={player.name}
      onChange={(e) => setPlayer({ ...player, name: e.target.value })}
      className="border p-2 mr-2 rounded"
    />
    <select
      value={player.class}
      onChange={(e) => setPlayer({ ...player, class: e.target.value })}
      className="border p-2 mr-2 rounded"
    >
      {classOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </select>
    <select
      value={player.role}
      onChange={(e) => setPlayer({ ...player, role: e.target.value })}
      className="border p-2 mr-2 rounded"
    >
      {availableRoles.map(role => (
        <option key={role} value={role}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </option>
      ))}
    </select>
    <select
      value={player.spec}
      onChange={(e) => setPlayer({ ...player, spec: e.target.value })}
      className="border p-2 mr-2 rounded"
    >
      {availableSpecs.map(option => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </select>
    <select
      value={player.offspec}
      onChange={(e) => setPlayer({ ...player, offspec: e.target.value })}
      className="border p-2 mr-2 rounded"
    >
      {availableSpecs.map(option => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </select>
    <button
      onClick={handleSubmit}
      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
    >
      {buttonText}
    </button>
    {cancelEdit && (
      <button
        onClick={cancelEdit}
        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition duration-200 ml-2"
      >
        Cancel
      </button>
    )}
  </div>
);

const PlayerDetails = ({ player, setEditingPlayer }) => (
  <div>
    <h2 className="text-xl font-semibold">{player.name}</h2>
    <p className="text-gray-600">{player.role}</p>
    <p className="text-gray-600">{player.class}</p>
    <p className="text-gray-600">{player.spec}</p>
    <p className="text-gray-600">{player.offspec}</p>
  </div>
);

export default Players;
