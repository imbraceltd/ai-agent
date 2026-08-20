export function getRoomReadableTime(roomTimestamp: string) {
    if (
        new Date(roomTimestamp).getDate() === new Date().getDate() && // if today, render the time
        new Date(roomTimestamp).getMonth() === new Date().getMonth() &&
        new Date(roomTimestamp).getFullYear() === new Date().getFullYear()
    ) {
        return `${new Date(roomTimestamp).getHours().toString().padStart(2, '0')}:${new Date(roomTimestamp)
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
    }

    return `${new Date(roomTimestamp).getDate()}/${new Date(roomTimestamp).getMonth() + 1}/${new Date(roomTimestamp).getFullYear()}`;
}
