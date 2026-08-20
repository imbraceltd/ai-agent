export function addLeadingZero(number: number): string {
    return number.toString().padStart(2, '0');
}
