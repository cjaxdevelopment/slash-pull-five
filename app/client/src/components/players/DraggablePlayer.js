import React, { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import axios from '../../axiosConfig'; // Import axios for fetching player details

const DraggablePlayer = ({ playerId, roleIcons, classIcons, specIcons }) => {
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const response = await axios.get(`/api/players/${playerId}`);
        setPlayer(response.data);
      } catch (error) {
        console.error('Error fetching player details:', error);
      }
    };

    fetchPlayer();
  }, [playerId]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PLAYER',
    item: { id: playerId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  if (!player) {
    return <div>Loading...</div>;
  }

  return (
    <div
      ref={drag}
      className={`p-4 border rounded mb-2 flex justify-between items-center ${isDragging ? 'bg-gray-400' : 'bg-white'}`}
      style={{ minWidth: '280px' }}
    >
      <div className="flex items-center space-x-2">
        <img src={roleIcons[player.role]} alt={player.role} className="w-6 h-6 rounded-full" />
        <span className="pl-4 font-bold">{player.name}</span>
      </div>
      <div className="flex items-center space-x-2">
        <img src={classIcons[player.class]} alt={player.class} className="w-6 h-6 rounded-full" />
        <img src={specIcons[player.spec]} alt={player.spec} className="w-6 h-6 rounded-full" />
        <img src={specIcons[player.offspec]} alt={player.offspec} className="w-6 h-6 rounded-full" />
      </div>
    </div>
  );
};

export default DraggablePlayer;
