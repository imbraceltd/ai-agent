import type { AnyAction, Reducer } from '@reduxjs/toolkit';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { createBrowserHistory } from 'history';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import { createReduxHistoryContext } from 'redux-first-history';
import { createLogger } from 'redux-logger';

import { queryClient } from '@/App';
import reducers from './slices';

const reduxLogger = createLogger({
    collapsed: true,
    duration: true,
});

const browserHistory = createBrowserHistory();

const { createReduxHistory, routerMiddleware, routerReducer } = createReduxHistoryContext({ history: browserHistory });

const combinedReducer = combineReducers({
    router: routerReducer,
    ...reducers,
});

export type RootState = ReturnType<typeof combinedReducer>;

const rootReducer: Reducer = (state: RootState, action: AnyAction) => {
    if (action.type === 'Access/logoutReset') {
        state = {
            Access: {
                loadingStatus: 'IDLE',
                isLoggedIn: action.payload,
            },
        } as RootState;
        queryClient.clear();
    }
    return combinedReducer(state, action);
};

export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>


        getDefaultMiddleware().concat(reduxLogger, routerMiddleware),

    devTools: true
});

// if (env.VITE_APP_ENV === 'prod') {
//     console.log = () => {};
// }

type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const history = createReduxHistory(store);

export default store;
