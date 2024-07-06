import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { classOptions, specOptions, classRoleOptions } from '../../playerOptions';

const AddPlayerCard = ({ onAddPlayer }) => {
  const defaultClass = 'warrior';
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    role: classRoleOptions[defaultClass][0],
    class: defaultClass,
    spec: specOptions[defaultClass][0].value,
    offspec: specOptions[defaultClass][1].value,
  });
  const [availableSpecs, setAvailableSpecs] = useState(specOptions[defaultClass]);
  const [availableRoles, setAvailableRoles] = useState(classRoleOptions[defaultClass]);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setAvailableSpecs(specOptions[newPlayer.class]);
    setNewPlayer((prevState) => ({
      ...prevState,
      spec: specOptions[newPlayer.class][0].value,
      offspec: specOptions[newPlayer.class][1].value,
      role: classRoleOptions[newPlayer.class][0],
    }));
    setAvailableRoles(classRoleOptions[newPlayer.class]);
  }, [newPlayer.class]);

  const handleAddPlayer = () => {
    if (newPlayer.name && newPlayer.role && newPlayer.class && newPlayer.spec && newPlayer.offspec) {
      onAddPlayer(newPlayer);
      setIsExpanded(false);
      setNewPlayer({
        name: '',
        role: classRoleOptions[defaultClass][0],
        class: defaultClass,
        spec: specOptions[defaultClass][0].value,
        offspec: specOptions[defaultClass][1].value,
      });
    }
  };

  return (
    <div
      className={`relative p-4 border mb-2 flex flex-col cursor-pointer ${isExpanded ? 'w-full col-span-full' : 'col-span-1'} bg-gray-100 hover:bg-gray-200 transition-colors duration-200 rounded-lg shadow-sm`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {!isExpanded ? (
        <div className="flex items-center justify-center w-full h-full text-center text-gray-500">
          <FontAwesomeIcon icon={faPlus} className="text-3xl" />
        </div>
      ) : (
        <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Player Name"
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              className="border p-2 rounded"
            />
            <select
              value={newPlayer.class}
              onChange={(e) => setNewPlayer({ ...newPlayer, class: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">Select Class</option>
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              value={newPlayer.role}
              onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}
              className="border p-2 rounded"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={newPlayer.spec}
              onChange={(e) => setNewPlayer({ ...newPlayer, spec: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">Select Spec</option>
              {availableSpecs.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              value={newPlayer.offspec}
              onChange={(e) => setNewPlayer({ ...newPlayer, offspec: e.target.value })}
              className="border p-2 rounded"
            >
              {availableSpecs.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddPlayer}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 transition duration-200 mt-2"
          >
            Add Player
          </button>
        </div>
      )}
    </div>
  );
};

export default AddPlayerCard;
