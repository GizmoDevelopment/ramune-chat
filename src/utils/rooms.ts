export function sanitizeRoomId (roomId: string) {
    return JSON.stringify(roomId); // DIY string sanitization, please don't actually do this
}