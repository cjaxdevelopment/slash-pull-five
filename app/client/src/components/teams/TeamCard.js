import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import DraggablePlayer from '../players/DraggablePlayer';
import { roleIcons, classIcons, specIcons } from '../../icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tippy';
import 'tippy.js/dist/tippy.css';
import { calculateBuffs, allBuffs } from '../../playerBuffs';
import AddPlayerCard from './AddPlayerCard';

const TeamCard = ({ team, players, onDropPlayer, onAddPlayer, onEditTeam, onDeleteTeam }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'PLAYER',
    drop: (item) => onDropPlayer(item.id, team._id),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const { coveredBuffs, missingBuffs } = calculateBuffs(players);

  const tooltipContent = (
    <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '5px', color: 'black' }}>
      <strong>Missing Buffs:</strong>
      <ul>
        {missingBuffs.map(buff => (
          <li key={buff}>{buff}</li>
        ))}
      </ul>
    </div>
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editedTeam, setEditedTeam] = useState({ name: team.name, description: team.description, color: team.color });

  const handleSaveEdit = () => {
    onEditTeam(team._id, editedTeam);
    setIsEditing(false);
  };

  return (
    <div ref={drop} className={`relative min-w-[400px] max-w-[500px] p-6 border rounded-lg ${isOver ? 'bg-green-200' : 'bg-gray-100'} flex flex-col`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">{team.name}</h2>
        <div className="flex items-center space-x-2">
          <FontAwesomeIcon icon={faEdit} className="text-gray-600 cursor-pointer" onClick={() => setIsEditing(true)} />
          <FontAwesomeIcon icon={faTrash} className="text-gray-600 cursor-pointer" onClick={() => onDeleteTeam(team._id)} />
        </div>
      </div>
      {isEditing ? (
        <div className="mb-4">
          <input
            type="text"
            value={editedTeam.name}
            onChange={(e) => setEditedTeam({ ...editedTeam, name: e.target.value })}
            className="border p-2 rounded w-full mb-2"
          />
          <textarea
            value={editedTeam.description}
            onChange={(e) => setEditedTeam({ ...editedTeam, description: e.target.value })}
            className="border p-2 rounded w-full mb-2"
          />
          <input
            type="color"
            value={editedTeam.color}
            onChange={(e) => setEditedTeam({ ...editedTeam, color: e.target.value })}
            className="border p-2 rounded w-full mb-2"
          />
          <button
            onClick={handleSaveEdit}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition duration-200 ml-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-4">{team.description}</p>
          <div className="mt-4 p-2 -mb-1 rounded-t-lg" style={{ backgroundColor: team.color }}>
            <div className="ml-2 flex justify items-center">
              <p className="text-gray-100 mr-2">{coveredBuffs}/{allBuffs.length} Buffs Covered</p>
              <Tooltip
                html={tooltipContent}
                position="top"
                trigger="mouseenter"
                arrow={true}
              >
                <FontAwesomeIcon icon={faInfoCircle} className="text-gray-100 cursor-pointer" />
              </Tooltip>
            </div>
          </div>
          <div className="bg-white p-4 rounded flex-grow" style={{ backgroundColor: team.color }}>
            <div className="grid grid-cols-2 gap-4">
              {players.map(player => (
                <DraggablePlayer
                  key={player._id}
                  playerId={player._id}
                  roleIcons={roleIcons}
                  classIcons={classIcons}
                  specIcons={specIcons}
                />
              ))}
              <AddPlayerCard onAddPlayer={onAddPlayer} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamCard;
