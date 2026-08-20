import type { ReactNode } from 'react';
import { createContext } from 'react';

interface CommentContextType {
    onFinish?: () => Promise<void>;
}

export const CommentContext = createContext<CommentContextType>({});

const CommentContextProvider = ({ children, onFinish }: { children: ReactNode; onFinish?: () => Promise<void> }) => {
    return (
        <CommentContext.Provider
            value={{
                onFinish,
            }}
        >
            {children}
        </CommentContext.Provider>
    );
};

export default CommentContextProvider;
