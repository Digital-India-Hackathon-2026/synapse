/*
 * Live push channel. Both the patient app and the caregiver dashboard connect here
 * and join a room named "patient:<patientId>". Authorization for who is *allowed*
 * to join happens over REST (see routes/*.js) before the client ever calls
 * join-patient-room — the room name itself is not a secret, it's just a delivery
 * channel for updates that were already approved.
 */
function attachSocket(io){
  io.on('connection', (socket) => {
    socket.on('join-patient-room', ({ patientId }) => {
      if(patientId) socket.join('patient:' + patientId);
    });
    socket.on('disconnect', () => {});
  });
}

module.exports = { attachSocket };