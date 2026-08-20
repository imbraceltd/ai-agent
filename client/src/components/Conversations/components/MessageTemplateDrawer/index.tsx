import { Search } from '@imbrace/ui';
import { Close as CloseIcon } from '@mui/icons-material';
import { Box, CircularProgress, Divider, Drawer, IconButton, Typography } from '@mui/material';
import debounce from 'lodash/debounce';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useInfiniteScroll from 'react-infinite-scroll-hook';

import { FETCH_FAILED, FETCH_IN_PROGRESS, IDLE } from '@/constants/app';
import { fetchMessageTemplates, selectMessageTemplate } from '@/redux/slices/messageTemplates';
import { resetSelectWhatsAppMessage } from '@/redux/slices/whatsAppTemplates';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { isNull } from '@/utils/StringHelper';

import MessageTemplateCard from '../MessageTemplateCard';
import styles from './index.module.scss';

interface MessageTemplateDrawerProps {
    open: boolean;
    width?: string;
    setCurrentDrawer: (value: string) => void;
}

const MessageTemplateDrawer: FC<MessageTemplateDrawerProps> = (props) => {
    const {
        open,
        width,
        setCurrentDrawer,
        // onOpen, loading
    } = props;
    const { i18n } = useTranslation();
    const drawerWidth = !isNull(width) ? `${width}` : '20vw';
    const dispatch = useAppDispatch();
    const messageTemplatesList = useAppSelector((state) => state.MessageTemplates.list);
    const hasMore = useAppSelector((state) => state.MessageTemplates.hasMore);
    const skip = useAppSelector((state) => state.MessageTemplates.skip);
    const limit = useAppSelector((state) => state.MessageTemplates.limit);
    const loadingStatus = useAppSelector((state) => state.MessageTemplates.loadingStatus);
    const { t } = useTranslation();
    const [searchbarInput, setSearchbarInput] = useState('');
    const [searchRange, setSearchRange] = useState<string>('title');
    const [containerRef] = useInfiniteScroll({
        loading: loadingStatus === FETCH_IN_PROGRESS,
        hasNextPage: hasMore,
        onLoadMore: () => {
            dispatch(fetchMessageTemplates({ limit, skip: loadingStatus === IDLE ? skip : skip + limit, search: searchbarInput }));
        },
        disabled: loadingStatus === FETCH_FAILED,
        rootMargin: '0px 0px 400px 0px',
    });

    const fetchMessageTemplatesMemo = useMemo(
        () =>
            debounce((field, search) => {
                dispatch(fetchMessageTemplates({ limit: 10, skip: 0, field, search }));
            }, 200),
        [dispatch],
    );

    useEffect(() => {
        fetchMessageTemplatesMemo(searchRange, searchbarInput);
    }, [fetchMessageTemplatesMemo, searchRange, searchbarInput]);

    const resetSearchInput = () => {
        setSearchbarInput('');
    };

    const messageTemplateOnClick = (template: API.MessageTemplate) => {
        dispatch(resetSelectWhatsAppMessage());
        dispatch(selectMessageTemplate(template));
        setCurrentDrawer('closed');
    };

    return (
        <Drawer
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                position: 'absolute',
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                },
            }}
            variant="persistent"
            anchor="right"
            hideBackdrop
            open={open}
        >
            <Box className={styles.msgTemplateDrawerHeader}>
                <Typography variant="h6">{t('chatroom_reply_history_heading')}</Typography>
                <IconButton onClick={() => setCurrentDrawer('closed')}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Divider />
            <Box className={styles.msgTemplateDrawerInputContainer}>
                <Search
                    queryKey={['search-range', i18n.language]}
                    requestFn={async () => {
                        return [
                            { text: t('message_templates_search_title'), value: 'title' },
                            { text: t('message_templates_search_content'), value: 'content' },
                            { text: t('message_templates_search_title_and_content'), value: 'all' },
                        ];
                    }}
                    defaultSelectValue="title"
                    value={searchbarInput}
                    onSearch={(inputValue, selectedValue) => {
                        setSearchbarInput(inputValue);
                        selectedValue && setSearchRange(selectedValue);
                    }}
                    onReset={resetSearchInput}
                    fullWidth
                    placeholder={t('search')}
                />
            </Box>
            <Divider />
            <Box className={styles.msgTemplateDrawerContentContainer}>
                {messageTemplatesList.map((obj: API.MessageTemplate) => (
                    <MessageTemplateCard
                        key={obj?.id}
                        id={obj?.id}
                        title={obj?.title}
                        content={obj?.text}
                        messageTemplateOnClick={() => messageTemplateOnClick(obj)}
                    />
                ))}
                {(loadingStatus === FETCH_IN_PROGRESS || hasMore) && (
                    <div className={styles.msgTemplateLoadingContainer} ref={containerRef}>
                        <CircularProgress color="imbrace_blue" />
                    </div>
                )}
            </Box>
        </Drawer>
    );
};

export default MessageTemplateDrawer;
