import { FieldSelect, Illustration, Search, Space, Typography } from '@imbrace/ui';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Drawer, IconButton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';
import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { selectWhatsAppMessage } from '@/redux/slices/whatsAppTemplates';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import * as whatsAppMessageTemplatesApi from '@/services/api/whatsAppMessageTemplates';
import apiFetch from '@/services/axios/handler';
import { isNull } from '@/utils/StringHelper';

import MessageTemplateCard, { statusMapping } from './messageTemplateCard';

type Status = 'APPROVED' | 'REJECTED' | 'PENDING' | 'ALL';
type Lang = 'en' | 'zh' | 'cn' | 'ALL';

function getFilteredTemplates(lang: Lang, status: Status, range: string, keyword: string, array: API.WhatsAppMessageTemplate[]) {
    const filteredByStatus = status === 'ALL' ? array : array.filter((obj) => obj.status === status);

    const filteredByLang =
        lang === 'ALL'
            ? filteredByStatus
            : filteredByStatus.filter((obj) => {
                  const templateLang = obj.language;
                  switch (lang) {
                      case 'en':
                          return templateLang === 'en' || templateLang === 'en_GB' || templateLang === 'en_US';
                      case 'zh':
                          return templateLang === 'zh_HK' || templateLang === 'zh_TW';
                      case 'cn':
                          return templateLang === 'zh_CN';
                      default:
                          return false;
                  }
              });

    switch (range) {
        case 'title':
            return filteredByLang.filter((obj) => {
                return obj.template_name?.toLowerCase().includes(keyword?.trim().toLowerCase());
            });
        case 'content':
            return filteredByLang.filter((obj) => {
                return obj.text?.toLowerCase().includes(keyword?.trim().toLowerCase());
            });
        case 'all':
        default:
            return filteredByLang.filter((obj) => {
                return (
                    obj.template_name?.toLowerCase().includes(keyword?.trim().toLowerCase()) ||
                    obj.text?.toLowerCase().includes(keyword?.trim().toLowerCase())
                );
            });
    }
}

interface WhatsAppMessageTemplateDrawerProps {
    open: boolean;
    width?: string;
    setCurrentDrawer: (status: string) => void;
}

const WhatsAppMsgTemplateBody: FC<WhatsAppMessageTemplateDrawerProps> = (props: WhatsAppMessageTemplateDrawerProps) => {
    const { open, setCurrentDrawer } = props;
    const { t, i18n } = useTranslation();
    const dispatch = useAppDispatch();
    const businessUnitId = useAppSelector((state) => state.BusinessUnit.businessUnitList[0].id);
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);
    const channelId = teamConversation?.channel_id;
    const [searchbarInput, setSearchbarInput] = useState<string>('');
    const [searchRange, setSearchRange] = useState('title');
    const [lang, setLang] = useState<Lang>((i18n.language as Lang) ?? 'en');
    const [status, setStatus] = useState<Status>('APPROVED');

    const debouncedSearchInput = useDebounce(searchbarInput, 300);

    const onFetchTemplates = useCallback(async () => {
        if (!channelId) return;
        try {
            const api = whatsAppMessageTemplatesApi.getWhatsAppMessageListsV2.api(businessUnitId, channelId);
            const { data } = await apiFetch<API.PaginatedResponse<API.WhatsAppMessageTemplate[]>>(
                api,
                whatsAppMessageTemplatesApi.getWhatsAppMessageListsV2.method,
            );
            return data;
        } catch (error) {
            console.error(error);
        }
    }, [businessUnitId, channelId]);

    const { data: waTemplates } = useQuery({
        queryKey: ['wa-templates', channelId],
        queryFn: onFetchTemplates,
        enabled: !!channelId && open,
    });

    const resetSearchInput = () => {
        setSearchbarInput('');
    };

    const messageTemplateOnClick = (template: API.WhatsAppMessageTemplate) => {
        dispatch(selectWhatsAppMessage(template));
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
                        {t('messagelist-input-whatsapp')}
                    </Typography>
                    <IconButton onClick={() => setCurrentDrawer('closed')}>
                        <CloseIcon />
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
                                setLang(e as Lang);
                            }}
                        />
                        <FieldSelect
                            fullWidth
                            queryKey={['wa-template-status']}
                            placeholder={t('click_to_select')}
                            formControlSx={{ width: '100%' }}
                            request={async () => {
                                return [
                                    {
                                        text: t('message_templates_all_status'),
                                        value: 'ALL',
                                    },
                                    {
                                        icon: (
                                            <div
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '1px',
                                                    backgroundColor: statusMapping.APPROVED.color,
                                                }}
                                            />
                                        ),
                                        text: t('approved'),
                                        value: 'APPROVED',
                                    },
                                    {
                                        icon: (
                                            <div
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '1px',
                                                    backgroundColor: statusMapping.PENDING.color,
                                                }}
                                            />
                                        ),
                                        text: t('pending'),
                                        value: 'PENDING',
                                    },
                                    {
                                        icon: (
                                            <div
                                                style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '1px',
                                                    backgroundColor: statusMapping.REJECTED.color,
                                                }}
                                            />
                                        ),
                                        text: t('rejected'),
                                        value: 'REJECTED',
                                    },
                                ];
                            }}
                            value={status}
                            onChange={(e, isValid) => {
                                setStatus(e as Status);
                            }}
                        />
                    </Space>
                    <Space
                        style={{
                            width: '100%',
                            padding: '0 16px',
                        }}
                    >
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
                                if (selectedValue) setSearchRange(selectedValue);
                            }}
                            onReset={(e) => {
                                e.stopPropagation();
                                resetSearchInput();
                            }}
                            fullWidth
                            placeholder={t('search')}
                        />
                    </Space>
                </Space>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', width: '100%' }}>
                <Space
                    direction="vertical"
                    style={{
                        width: '100%',
                        gap: 0,
                    }}
                >
                    {!waTemplates ||
                        (waTemplates.data.length === 0 && (
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="Body">{t('message_templates_empty')}</Typography>
                            </Box>
                        ))}
                    {waTemplates &&
                        (() => {
                            const filteredTemplates = getFilteredTemplates(
                                lang,
                                status,
                                searchRange,
                                debouncedSearchInput,
                                waTemplates?.data,
                            );
                            if (!searchbarInput && filteredTemplates.length === 0) {
                                return (
                                    <Illustration
                                        name={'templateEmpty'}
                                        description={
                                            <div>
                                                <Typography variant="SubHeading2">{t('message_templates_empty_list_header')}</Typography>
                                                <Typography variant="Body">{t('message_templates_empty_list_description')}</Typography>
                                            </div>
                                        }
                                    />
                                );
                            }
                            if (searchbarInput && filteredTemplates.length === 0) {
                                return (
                                    <Illustration
                                        name={'templateEmpty'}
                                        description={
                                            <div>
                                                <Typography variant="SubHeading2">
                                                    {t('message_templates_empty_list_search_header')}
                                                </Typography>
                                                <Typography variant="Body">
                                                    {t('message_templates_empty_list_search_description')}
                                                </Typography>
                                            </div>
                                        }
                                    />
                                );
                            }
                            return filteredTemplates.map((obj) => (
                                <MessageTemplateCard
                                    key={obj?.id}
                                    id={obj?.id}
                                    title={obj?.template_name}
                                    content={obj?.text}
                                    status={obj?.status}
                                    language={obj?.language}
                                    messageTemplateOnClick={() => {
                                        if (obj.status !== 'APPROVED') return;
                                        messageTemplateOnClick(obj);
                                    }}
                                />
                            ));
                        })()}
                </Space>
            </div>
        </Space>
    );
};
const WhatsAppMessageTemplateDrawer: FC<WhatsAppMessageTemplateDrawerProps> = (props) => {
    const { open, width, setCurrentDrawer } = props;
    const drawerWidth = !isNull(width) ? `${width}` : '20vw';
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);

    useEffect(() => {
        if (teamConversation?.id) {
            setCurrentDrawer('closed');
        }
    }, [teamConversation?.id, setCurrentDrawer]);

    return (
        <Drawer
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                position: 'absolute',
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    height: '100vh',
                    boxSizing: 'border-box',
                    boxShadow: '-2px 0px 24px 0px #E0E0E033, -4px 0px 8px 0px #BDBDBD14',
                    borderLeft: '1px solid var(--color-light-3)',
                },
            }}
            anchor="right"
            hideBackdrop
            open={open}
        >
            <WhatsAppMsgTemplateBody setCurrentDrawer={setCurrentDrawer} open={open} />
        </Drawer>
    );
};

export default WhatsAppMessageTemplateDrawer;
