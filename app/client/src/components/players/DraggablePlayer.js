import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import axios from '../../axiosConfig';
import { useDispatch } from 'react-redux';
import { updatePlayer, deletePlayer } from '../../features/players/playersSlice';
import { classOptions, roleOptions, specOptions, classRoleOptions } from '../../playerOptions';

const classColors = {
  death_knight: '#C41F3B',
  demon_hunter: '#A330C9',
  druid: '#FF7D0A',
  hunter: '#ABD473',
  mage: '#69CCF0',
  monk: '#00FF96',
  paladin: '#F58CBA',
  priest: '#FFFFFF',
  rogue: '#FFF569',
  shaman: '#0070DE',
  warlock: '#9482C9',
  warrior: '#C79C6E',
};

const DraggablePlayer = ({ playerId, roleIcons, classIcons, specIcons }) => {
  const [player, setPlayer] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [availableSpecs, setAvailableSpecs] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const ref = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const response = await axios.get(`/api/players/${playerId}`);
        setPlayer(response.data);
        setAvailableSpecs(specOptions[response.data.class]);
        setAvailableRoles(classRoleOptions[response.data.class]);
      } catch (error) {
        console.error('Error fetching player details:', error);
      }
    };

    fetchPlayer();
  }, [playerId]);

  useEffect(() => {
    if (player && player.class) {
      setAvailableSpecs(specOptions[player.class]);
      setAvailableRoles(classRoleOptions[player.class]);
    }
  }, [player]);

  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'PLAYER',
    item: { id: playerId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  useEffect(() => {
    if (ref.current) {
      preview(ref.current);
    }
  }, [preview]);

  const handleUpdatePlayer = async () => {
    if (player.name && player.role && player.class && player.spec) {
      try {
        const response = await axios.patch(`/api/players/players/${playerId}`, player);
        dispatch(updatePlayer({ id: playerId, updates: response.data }));
        setIsEditing(false);
      } catch (error) {
        console.error('Error updating player:', error);
      }
    }
  };

  const handleRemovePlayer = async () => {
    try {
      await dispatch(deletePlayer(playerId));
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };

  if (!player) {
    return <div>Loading...</div>;
  }

  const backgroundColor = classColors[player.class] || 'white';

  return (
    <div
      ref={(node) => {
        ref.current = node;
        drag(node);
      }}
      className={`relative p-4 border mb-2 flex flex-col ${isDragging ? 'opacity-50' : ''} ${isEditing ? 'w-full col-span-full' : 'col-span-1'} bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors duration-200`}
      style={{ backgroundColor }}
      onClick={() => setIsEditing(!isEditing)}
    >
      <div className="flex items-center space-x-2 w-full z-10">
        <div className="absolute top-0 left-0 w-4 h-4 z-20">
          <img src={roleIcons[player.role]} alt={player.role} className="object-cover" />
        </div>
        <span className="pl-2 font-bold truncate w-5/6 max-w-xs">{player.name}</span>
      </div>
      <div className="absolute inset-y-0 right-0 w-1/3 h-full overflow-hidden pointer-events-none">
        <div className="relative w-full h-full transform -skew-x-12 origin-bottom-right scale-100">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <img src={specIcons[player.spec]} alt={player.spec} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        </div>
      </div>
      {isEditing && (
        <div className="mt-2 w-2/3" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={player.name}
              onChange={(e) => setPlayer({ ...player, name: e.target.value })}
              className="border p-2 rounded"
            />
            <select
              value={player.class}
              onChange={(e) => setPlayer({ ...player, class: e.target.value })}
              className="border p-2 rounded"
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
              className="border p-2 rounded"
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
              className="border p-2 rounded"
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
              className="border p-2 rounded"
            >
              {availableSpecs.map(option => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleUpdatePlayer}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 transition duration-200"
            >
              Save
            </button>
            <button
              onClick={handleRemovePlayer}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-200"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggablePlayer;
