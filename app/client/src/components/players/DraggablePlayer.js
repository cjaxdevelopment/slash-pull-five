import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import axios from '../../axiosConfig'; // Import axios for fetching player details

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
  const ref = useRef(null);

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
      className={`relative p-4 border rounded mb-2 flex justify-between items-center ${isDragging ? 'opacity-50' : ''}`}
      style={{ cursor: 'move', backgroundColor }}
    >
      <div className="flex items-center space-x-2 w-full z-10">
        <img src={roleIcons[player.role]} alt={player.role} className="w-6 h-6 rounded-full" />
        <span className="pl-4 font-bold truncate w-full max-w-xs">{player.name}</span>
      </div>
      {/* <div className="flex items-center space-x-2 z-10">
        <img src={specIcons[player.spec]} alt={player.spec} className="w-6 h-6 rounded-full" />
        {player.offspec && (
          <img src={specIcons[player.offspec]} alt={player.offspec} className="w-6 h-6 rounded-full" />
        )}
      </div> */}
      <div className="absolute inset-0 flex justify-end items-center pointer-events-none ">
        <div className="relative w-1/5 h-full ">
          <div className="absolute inset-0 bg-black opacity-50 transform"></div>
          <img src={specIcons[player.spec]} alt={player.spec} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        </div>
      </div>
    </div>
  );
};

export default DraggablePlayer;
