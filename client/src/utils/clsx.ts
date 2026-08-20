export default function clsx(...classes: (string | false | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}
