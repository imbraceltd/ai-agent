import { FieldSelect, Icon, IconButton, Illustration, Search, Space, Typography } from '@imbrace/ui';
import { Drawer } from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';

import type { RequestParameters } from '@/components/FlexibleTable/types';
import TooltipWithHelpIcon from '@/components/TooltipWithHelpIcon';
import { insertMessageTemplate, selectMessageTemplate } from '@/redux/slices/messageTemplates';
import { resetSelectWhatsAppMessage } from '@/redux/slices/whatsAppTemplates';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { getMessageTemplatesListV2, getTemplateCategories } from '@/services/api/messageTemplates';
import { ImbraceClient } from '@/services/axios';
import apiFetch from '@/services/axios/handler';
import { isNull } from '@/utils/StringHelper';

import MessageTemplateCard from './messageTemplateCard';

interface MessageTemplateDrawerV2Props {
    open: boolean;
    width?: string;
    setCurrentDrawer: (status: string) => void;
}

const fetchMessageTemplates =
    (businessId: string, category: string, lang: string, searchRange: string, searchQuery: string) =>
    async (params: RequestParameters, signal?: AbortSignal) => {
        const { pagination, sorters } = params;
        const sort = !sorters || sorters?.length === 0 ? '-updated_at' : `${sorters[0]?.desc ? '-' : ''}${sorters[0]?.id}`;

        const searchParams = new URLSearchParams();
        searchParams.append('business_unit_id', businessId);
        if (pagination) {
            searchParams.append('limit', `${pagination.pageSize ?? 10}`); // Ensure limit is set to 10 items per page
            searchParams.append('skip', `${pagination.pageIndex * (pagination.pageSize ?? 10)}`);
            searchParams.append('sort', `${sort}`);
            if (category !== 'ALL') {
                searchParams.append('category', `${category}`);
            }
            if (lang !== 'ALL') {
                searchParams.append('lang', `${lang}`);
            }
        }

        if (searchQuery) {
            searchParams.append('q', `${searchQuery}`);
        }

        switch (searchRange) {
            case 'title':
                searchParams.append('fields', `${'title'}`);
                break;
            case 'content':
                searchParams.append('fields', `${'text'}`);
                break;
            default:
                searchParams.append('fields', `${'title,text'}`);
        }

        const { data } = await apiFetch<API.PaginatedResponse<API.MessageTemplate[]>>(
            getMessageTemplatesListV2.api(),
            getMessageTemplatesListV2.method,
            searchParams,
            ImbraceClient,
            {
                signal,
            },
        );
        return {
            data: data.data,
            total: data.count,
            skip: (pagination?.pageIndex ?? 0) * (pagination?.pageSize ?? 10),
            limit: pagination?.pageSize ?? 10,
            has_more: data.has_more,
            unread_count: data.unread_count ?? 0,
        };
    };

const MsgTemplateBody: FC<Omit<MessageTemplateDrawerV2Props, 'open'>> = (props) => {
    const { setCurrentDrawer } = props;
    const { ref, inView } = useInView();
    const { t, i18n } = useTranslation();
    const dispatch = useAppDispatch();
    const businessUnitId = useAppSelector((state) => state.BusinessUnit.businessUnitList[0].id);

    const [lang, setLang] = useState('ALL');
    const [category, setCategory] = useState('ALL');
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearchInput = useDebounce(searchInput, 300);
    const [searchRange, setSearchRange] = useState('title');

    const { data, fetchNextPage, hasNextPage, refetch, isFetching } = useInfiniteQuery({
        queryKey: ['messageTemplates', businessUnitId, category, lang, debouncedSearchInput, searchRange],
        queryFn: ({ pageParam = 0 }) => {
            return fetchMessageTemplates(
                businessUnitId,
                category,
                lang,
                searchRange,
                debouncedSearchInput,
            )({
                pagination: { pageSize: 15, pageIndex: pageParam },
            });
        },
        initialPageParam: 0,
        getPreviousPageParam: (firstPage) => (firstPage.skip > 0 ? firstPage.skip - 15 : undefined),
        getNextPageParam: (lastPage) => {
            const currentPage = lastPage.skip / lastPage.limit;
            const nextPage = currentPage + 1;
            if (lastPage.has_more) {
                return nextPage;
            }
            return undefined;
        },
    });

    useEffect(() => {
        if (debouncedSearchInput || lang || category) {
            refetch();
        }
    }, [debouncedSearchInput, lang, category, refetch]);

    useEffect(() => {
        if (inView && hasNextPage && !isFetching) {
            fetchNextPage();
        }
    }, [inView, fetchNextPage, hasNextPage, isFetching]);

    const messageTemplateOnClick = (template: API.MessageTemplate) => {
        dispatch(resetSelectWhatsAppMessage());
        const hasVariable: boolean = template.text.match(/{{\d+}}/i) === null ? false : true;
        hasVariable ? dispatch(selectMessageTemplate(template)) : dispatch(insertMessageTemplate(template));
        setCurrentDrawer('closed');
    };

    return (
        <Space direction="vertical" style={{ height: '100%', width: '100%' }}>
            <div style={{ width: '100%' }}>
                <Space
                    justify="between"
                    style={{
                        width: '100%',
                        padding: '24px 16px 16px 16px',
                    }}
                >
                    <Typography variant="Heading2" style={{ textTransform: 'capitalize' }}>
                        {t('messagelist-input-message')}
                    </Typography>
                    <IconButton variant="text" type="secondary" onClick={() => setCurrentDrawer('closed')}>
                        <Icon name="close" />
                    </IconButton>
                </Space>
                <Space direction="vertical" style={{ height: '100%', width: '100%', gap: '8px' }}>
                    <Space
                        style={{
                            width: '100%',
                            padding: '0 16px',
                            gap: '8px',
                        }}
                    >
                        <FieldSelect
                            fullWidth
                            queryKey={['templateLanguage']}
                            placeholder={t('click_to_select')}
                            formControlSx={{ width: '100%' }}
                            request={async () => {
                                return [
                                    {
                                        text: t('message_templates_all_languages'),
                                        value: 'ALL',
                                    },
                                    {
                                        text: 'English (US)',
                                        value: 'en',
                                    },
                                    {
                                        text: '繁體中文',
                                        value: 'zh',
                                    },
                                    {
                                        text: '简体中文',
                                        value: 'cn',
                                    },
                                ];
                            }}
                            value={lang}
                            onChange={(e, isValid) => {
                                setLang(e as string);
                            }}
                        />
                        <FieldSelect
                            fullWidth
                            queryKey={['templateCategory']}
                            placeholder={t('click_to_select')}
                            formControlSx={{ width: '100%' }}
                            request={async () => {
                                const { data: categoryData } = await apiFetch<{ data: API.TemplateCategory[] }>(
                                    getTemplateCategories.api,
                                    getTemplateCategories.method,
                                );
                                const categories = categoryData.data.map((item: API.TemplateCategory) => {
                                    return {
                                        text: (
                                            <Space size={8} style={{ color: 'var(--color-secondary-1)' }}>
                                                <Typography style={{ color: 'var(--color-light-7)', lineHeight: '20px' }}>
                                                    {item.name}
                                                </Typography>
                                                {item.description && <TooltipWithHelpIcon placement="bottom" title={item.description} />}
                                            </Space>
                                        ),
                                        value: item._id,
                                    };
                                });
                                return [
                                    {
                                        text: (
                                            <Space size={8} style={{ color: 'var(--color-secondary-1)' }}>
                                                <Typography style={{ color: 'var(--color-light-7)', lineHeight: '20px' }}>
                                                    {t('message_templates_all_categories')}
                                                </Typography>
                                            </Space>
                                        ),
                                        value: 'ALL',
                                    },
                                    ...categories,
                                ];
                            }}
                            value={category}
                            onChange={(e, isValid) => {
                                setCategory(e as string);
                            }}
                        />
                    </Space>
                    <Space style={{ width: '100%', padding: '0 16px' }}>
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
                            value={searchInput}
                            onSearch={(inputValue, selectedValue) => {
                                setSearchInput(inputValue);
                                if (selectedValue) setSearchRange(selectedValue);
                            }}
                            onReset={() => setSearchInput('')}
                            fullWidth
                            placeholder={t('search')}
                        />
                    </Space>
                </Space>
            </div>

            <div
                style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    width: '100%',
                }}
            >
                <Space
                    direction="vertical"
                    style={{
                        width: '100%',
                        gap: 0,
                    }}
                >
                    {data?.pages.map((template) => {
                        if (!debouncedSearchInput && template.data.length === 0) {
                            return (
                                <Illustration
                                    name={'templateEmpty'}
                                    description={
                                        <div>
                                            <Typography variant="SubHeading2">{t('message_templates_empty_list_header')}</Typography>
                                            <Typography variant="Body">
                                                <Trans i18nKey="message_template_empty_guide">
                                                    Contact your administration for help or{' '}
                                                    <Link to={'/templates?action=openMessageAddNew'}>create your first template</Link> now
                                                </Trans>
                                            </Typography>
                                        </div>
                                    }
                                />
                            );
                        }
                        if (debouncedSearchInput && template.data.length === 0) {
                            return (
                                <Illustration
                                    name={'templateEmpty'}
                                    description={
                                        <div>
                                            <Typography variant="SubHeading2">{t('message_templates_empty_list_search_header')}</Typography>
                                            <Typography variant="Body">
                                                <Trans i18nKey="message_template_search_empty_guide">
                                                    Check the spelling or{' '}
                                                    <Link to={'/templates?action=openMessageAddNew'}>create a new template</Link> for it.
                                                </Trans>
                                            </Typography>
                                        </div>
                                    }
                                />
                            );
                        }
                        return template.data.map((item) => (
                            <MessageTemplateCard key={item.id} messageTemplateOnClick={() => messageTemplateOnClick(item)} item={item} />
                        ));
                    })}
                </Space>
                <div ref={ref} />
            </div>
        </Space>
    );
};

const MessageTemplateDrawerV2: FC<MessageTemplateDrawerV2Props> = (props) => {
    const { open, width, setCurrentDrawer } = props;
    const drawerWidth = !isNull(width) ? `${width}` : '20vw';
    return (
        <Drawer
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                position: 'absolute',
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    height: '100vh', // Set the drawer to full viewport height
                    boxSizing: 'border-box',
                    boxShadow: '-2px 0px 24px 0px #E0E0E033, -4px 0px 8px 0px #BDBDBD14',
                    borderLeft: '1px solid var(--color-light-3)',
                },
            }}
            anchor="right"
            hideBackdrop
            open={open}
        >
            <MsgTemplateBody setCurrentDrawer={setCurrentDrawer} />
        </Drawer>
    );
};
export default MessageTemplateDrawerV2;
