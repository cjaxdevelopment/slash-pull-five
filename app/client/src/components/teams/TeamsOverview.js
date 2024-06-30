import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useDrop } from 'react-dnd';
import { fetchTeams } from '../../features/teams/teamsSlice';
import { fetchPlayers, updatePlayer, updateLocalPlayer } from '../../features/players/playersSlice';
import DraggablePlayer from '../players/DraggablePlayer';
import { roleIcons, classIcons, specIcons } from '../../icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tippy';
import 'tippy.js/dist/tippy.css';
import { calculateBuffs, allBuffs } from '../../playerBuffs';

const TeamsOverview = () => {
  const teams = useSelector(state => state.teams.teams);
  const players = useSelector(state => state.players.players);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchTeams());
    dispatch(fetchPlayers());
  }, [dispatch]);

  const handleDropPlayer = async (playerId, newTeamId) => {
    await dispatch(updatePlayer({ id: playerId, updates: { teamId: newTeamId } }));
    dispatch(updateLocalPlayer({ id: playerId, updates: { teamId: newTeamId } }));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-4">Teams Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => (
          <TeamCard
            key={team._id}
            team={team}
            players={players.filter(player => player.teamId === team._id)}
            onDropPlayer={handleDropPlayer}
          />
        ))}
      </div>
    </div>
  );
};

const TeamCard = ({ team, players, onDropPlayer }) => {
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

  return (
    <div ref={drop} className={`relative min-w-[400px] max-w-[500px] p-6 border rounded-lg ${isOver ? 'bg-green-200' : 'bg-gray-100'} flex flex-col`}>
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-2xl font-bold">{team.name}</h2>
        <div className="flex items-center space-x-2">
          <p className="text-gray-600">{coveredBuffs}/{allBuffs.length} Buffs Covered</p>
          <Tooltip
            html={tooltipContent}
            position="top"
            trigger="mouseenter"
            arrow={true}
          >
            <FontAwesomeIcon icon={faInfoCircle} className="text-gray-600 cursor-pointer" />
          </Tooltip>
        </div>
      </div>
      <p className="text-gray-600 mb-4">{team.description}</p>
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
        </div>
      </div>
    </div>
  );
};

export default TeamsOverview;
