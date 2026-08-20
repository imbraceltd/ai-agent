import type { Dispatch } from 'react';
import { useEffect, useState } from 'react';

interface Args extends IntersectionObserverInit {
    freezeOnceVisible?: boolean;
    lock?: boolean;
}

function useIntersectionObserver({
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
    lock = false,
}: Args): [Dispatch<HTMLElement>, IntersectionObserverEntry | undefined] {
    const [node, setNode] = useState<HTMLElement | null>();
    const [entry, setEntry] = useState<IntersectionObserverEntry>();

    const frozen = entry?.isIntersecting && freezeOnceVisible;

    const handleUpdateEntry = ([updateEntry]: IntersectionObserverEntry[]): void => {
        setEntry(updateEntry);
    };

    useEffect(() => {
        const hasIOSupport = !!window.IntersectionObserver;

        if (!hasIOSupport || frozen || !node || lock) return;

        const observerParams = { threshold, root, rootMargin };
        const observer = new IntersectionObserver(handleUpdateEntry, observerParams);

        observer.observe(node);

        return () => observer.disconnect();
    }, [node, threshold, root, rootMargin, frozen, lock]);

    return [setNode, entry];
}

export default useIntersectionObserver;
