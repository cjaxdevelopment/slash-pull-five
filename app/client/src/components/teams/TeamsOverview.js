import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchTeams, updateTeam, deleteTeam, addTeam } from '../../features/teams/teamsSlice';
import { fetchPlayers, updatePlayer, updateLocalPlayer } from '../../features/players/playersSlice';
import TeamCard from './TeamCard';
import ConfirmationModal from '../ConfirmationModal';
import AddTeamModal from '../AddTeamModal';
import Navbar from '../Navbar';
import axios from '../../axiosConfig';

const TeamsOverview = () => {
  const teams = useSelector(state => state.teams.teams);
  const players = useSelector(state => state.players.players);
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);

  useEffect(() => {
    dispatch(fetchTeams());
    dispatch(fetchPlayers());
  }, [dispatch]);

  const handleDropPlayer = async (playerId, newTeamId) => {
    await dispatch(updatePlayer({ id: playerId, updates: { teamId: newTeamId } }));
    dispatch(updateLocalPlayer({ id: playerId, updates: { teamId: newTeamId } }));
  };

  const handleAddPlayer = async (newPlayer, teamId) => {
    const playerData = { ...newPlayer, teamId };
    try {
      await axios.post('/api/players', playerData);
      dispatch(fetchPlayers()); // Refresh the players list
    } catch (error) {
      console.error('Error adding the player:', error);
    }
  };

  const handleAddTeam = async (newTeam) => {
    try {
      await dispatch(addTeam(newTeam)).unwrap();
    } catch (error) {
      console.error('Error adding team:', error);
    }
  };

  const handleEditTeam = async (teamId, updates) => {
    try {
      await dispatch(updateTeam({ id: teamId, updates }));
    } catch (error) {
      console.error('Error updating the team:', error);
    }
  };

  const handleOpenModal = (teamId) => {
    setTeamToDelete(teamId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTeamToDelete(null);
  };

  const handleConfirmDelete = async () => {
    try {
      await dispatch(deleteTeam(teamToDelete));
      handleCloseModal();
    } catch (error) {
      console.error('Error deleting the team:', error);
    }
  };

  return (
    <div>
      <Navbar onAddTeamClick={() => setIsAddTeamModalOpen(true)} showAddTeamButton={true} />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-4">Teams Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard
              key={team._id}
              team={team}
              players={players.filter(player => player.teamId === team._id)}
              onDropPlayer={handleDropPlayer}
              onAddPlayer={(newPlayer) => handleAddPlayer(newPlayer, team._id)}
              onEditTeam={handleEditTeam}
              onDeleteTeam={handleOpenModal}
            />
          ))}
        </div>
        <AddTeamModal
          isOpen={isAddTeamModalOpen}
          onClose={() => setIsAddTeamModalOpen(false)}
          onAddTeam={handleAddTeam}
        />
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </div>
  );
};

export default TeamsOverview;
