import { Search } from '@imbrace/ui';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { updateTeamConversationSearch } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';

import styles from './index.module.scss';

function ConversationSearchBar() {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const [search, setSearch] = useState('');
    const viewFilter = useAppSelector((state) => state.TeamConversation.viewFilter);
    const viewFilterTeamId = useAppSelector((state) => state.TeamConversation.viewFilterTeamId);
    const channelFilter = useAppSelector((state) => state.TeamConversation.channelFilter);
    const initialized = useRef<HTMLInputElement>(null);

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        dispatch(
            updateTeamConversationSearch({
                search: e.target.value,
            }),
        );
        setSearch(e.target.value);
    };

    const resetSearch = () => {
        if (initialized && initialized.current) {
            initialized.current.value = '';
        }
        setSearch('');
        dispatch(
            updateTeamConversationSearch({
                search: '',
            }),
        );
    };

    useEffect(() => {
        if (initialized && initialized.current) {
            initialized.current.value = '';
        }
        setSearch('');
        dispatch(
            updateTeamConversationSearch({
                search: '',
            }),
        );
    }, [viewFilter, viewFilterTeamId, channelFilter, dispatch]);

    return (
        <div className={styles.roomListSearchBar}>
            <Search
                value={search}
                onChange={(inputValue) => handleSearchChange(inputValue)}
                fullWidth
                placeholder={t('conversation_search')}
                onReset={resetSearch}
            />
        </div>
    );
}

export default ConversationSearchBar;
