import type { channelIconMapping, SelectRef } from '@imbrace/ui';
import { EllipsisText, FieldSelect, FieldText, Icon, Space, Typography } from '@imbrace/ui';
import type { ChannelIconTypes } from '@imbrace/ui/dist/components/Icon';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mergeRefs } from 'react-merge-refs';

import { getForms, getOrgJourneys } from '@/services/api/app';
import { getChannelList } from '@/services/api/channel';
import apiFetch from '@/services/axios/handler';

interface OriginFieldProps {
    value: API.OriginValue;
    onChange: (data: API.OriginValue | null) => void;
    enum?: Record<string | number, string>;
    disabled?: boolean;
    selectRef?: RefObject<SelectRef>;
}
const fetchChannel = async (channelType: API.ChannelType) => {
    const { data } = await apiFetch<API.PaginatedResponse<API.Channel[]>>(getChannelList.api(channelType), getChannelList.method);

    return data.data;
};
const fetchJourney = async () => {
    const { data } = await apiFetch<{ data: API.Journey[] }>(getOrgJourneys.api, getOrgJourneys.method);

    return data.data;
};

const OriginField = (props: OriginFieldProps) => {
    const { value, onChange, disabled } = props;
    const selectRef = useRef<SelectRef>(null);
    const { t } = useTranslation();
    const originalValue = useRef(value);

    const [queryParams, setQueryParams] = useState<{ step: string; channelType?: API.ChannelType; journeyType?: API.ProductType }>({
        step: 'default',
        channelType: 'web',
        journeyType: 'business_contact_collector',
    });
    const [mode, setMode] = useState<'select' | 'input'>('select');

    const handleSelectChannel = (channel: API.Channel) => {
        onChange?.({
            type: 'channel',
            data: {
                id: channel.id,
                name: channel.name,
                type: channel.config.type,
            },
        });
        selectRef.current?.close();
    };

    const handleSelectJourney = (journey: API.Journey) => {
        onChange?.({
            type: 'journey',
            data: {
                id: journey._id,
                name: journey.title,
                type: journey.product_code,
            },
        });
        selectRef.current?.close();
    };

    const handleSelectForm = (form: FormManagement.Form) => {
        onChange?.({
            type: 'journey',
            data: {
                id: form._id,
                name: `${t('journey_form_management_title')} - ${form.name}`,
                type: 'form_management',
            },
        });
        selectRef.current?.close();
    };

    const handleSelectCustomized = (data: string) => {
        onChange?.({
            type: 'customized',
            data: {
                id: data,
                name: data,
                type: '',
            },
        });
        selectRef.current?.close();
    };

    const handleSelectOther = () => {
        setMode('input');
    };

    useEffect(() => {
        if (
            originalValue.current &&
            !originalValue.current.data.id?.startsWith('app_') &&
            !originalValue.current.data.id?.startsWith('ch_') &&
            !props.enum?.[originalValue.current.data.name || '']
        ) {
            setMode('input');
        }
    }, [props.enum]);

    const fetchForms = async () => {
        const journeys = await fetchJourney();
        const formManagementJourneys = journeys.filter((journey) => journey.product_code === 'form_management');

        if (formManagementJourneys.length <= 0) {
            return [];
        }
        const { data } = await apiFetch<{ data: FormManagement.Form[] }>(getForms.api(), getForms.method);

        return data.data.map((form) => ({
            onClick: (e: React.MouseEvent<HTMLLIElement>) => {
                e.stopPropagation();
                e.preventDefault();
                selectRef.current?.close();
                handleSelectForm(form);
            },
            icon: <Icon name={'formManagement'} style={{ fontSize: 24 }} namespace={'channel'} />,
            text: (
                <Space
                    style={{
                        width: '100%',
                        display: 'inherit',
                    }}
                >
                    <EllipsisText text={`Form Management - ${form.name}`} />
                </Space>
            ),
            value: form._id,
        }));
    };

    if (mode === 'input') {
        return (
            <FieldText
                fullWidth
                onChange={(e) => {
                    onChange?.({
                        type: 'customized',
                        data: {
                            id: e.target.value,
                            name: e.target.value,
                            type: '',
                        },
                    });
                }}
                value={value?.data?.name}
                disabled={disabled}
                onReset={() => {
                    onChange?.(null);
                    setMode('select');
                    setQueryParams({
                        step: 'default',
                        channelType: 'web',
                    });
                }}
            />
        );
    }

    return (
        <FieldSelect<string, ['origin-field', { step: string; channelType?: API.ChannelType; journeyType?: API.ProductType }]>
            queryKey={['origin-field', queryParams]}
            ref={mergeRefs([selectRef, props.selectRef])}
            fullWidth
            emptyText={t('origin_option_empty')}
            request={async ({ queryKey }) => {
                const { step, channelType, journeyType } = queryKey[1];
                if (step === 'default') {
                    return [
                        {
                            text: t('customized_original_sources'),
                            description: t('customized_original_sources_description'),
                            value: 'customized',
                            onClick: () => {
                                setQueryParams({
                                    step: 'customized',
                                });
                            },
                            icon: <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />,

                            reverse: true,
                        },
                        {
                            text: t('system_original_sources'),
                            description: t('system_original_sources_description'),
                            value: 'system',
                            onClick: () => {
                                setQueryParams({
                                    step: 'system',
                                });
                            },
                            icon: <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />,

                            reverse: true,
                        },
                    ];
                }
                if (step === 'system') {
                    return [
                        {
                            icon: <Icon name="web" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('channel_web')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'web',
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'web',
                                });
                            },
                        },
                        {
                            icon: <Icon name="facebook" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('channel_facebook')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'facebook',
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'facebook',
                                });
                            },
                        },
                        {
                            icon: <Icon name="whatsapp" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('channel_whatsapp')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'whatsapp',
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'whatsapp',
                                });
                            },
                        },
                        {
                            icon: <Icon name="wechat" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('channel_wechat')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'wechat',
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'wechat',
                                });
                            },
                        },
                        {
                            icon: <Icon name="line" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('channel_line')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'line',
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'line',
                                });
                            },
                        },
                        {
                            icon: <Icon name="crm" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('journey_business_contact_collector_title')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'journey_business_contact_collector',
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'business_contact_collector',
                                });
                            },
                        },
                        {
                            icon: <Icon name="formManagement" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('journey_form_management_title')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'journey_form_management',
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'form_management',
                                });
                            },
                        },

                        {
                            icon: <Icon name="facebook" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('journey_facebook_social_media_management_title')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'journey_facebook_social_media_management',
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'facebook_social_media_management',
                                });
                            },
                        },
                        {
                            icon: <Icon name="facebook" fontSize={24} namespace="channel" />,
                            text: (
                                <Space justify="between" align="center" style={{ width: '100%' }}>
                                    <EllipsisText text={t('journey_facebook_leads_management_title')} />
                                    <Space>
                                        <Icon name="chevronRight" fontSize={24} style={{ color: 'var(--color-light-4)' }} />
                                    </Space>
                                </Space>
                            ),
                            value: 'journey_facebook_leads_management',
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'facebook_leads_management',
                                });
                            },
                        },
                    ];
                }
                if (step === 'channel' && channelType) {
                    const channelOptions = await fetchChannel(channelType);

                    return channelOptions.map((channel: API.Channel) => ({
                        onClick: (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleSelectChannel(channel);
                        },
                        icon: <Icon name={channel.config.type as ChannelIconTypes['name']} namespace="channel" style={{ fontSize: 24 }} />,
                        text: channel.name,
                        value: channel.id,
                        disabled: channel.is_init || 'errorCode' in channel,
                    }));
                }
                if (step === 'journey' && journeyType) {
                    if (journeyType === 'form_management') {
                        const formOptions = await fetchForms();
                        return formOptions;
                    }
                    const journeyOptions = await fetchJourney();

                    return journeyOptions
                        .filter((journey) => journey.product_code === journeyType)
                        .map((journey) => ({
                            onClick: (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                selectRef.current?.close();
                                handleSelectJourney(journey);
                            },
                            icon: (
                                <Icon
                                    name={journey.icon.name as ChannelIconTypes['name']}
                                    style={{ fontSize: 24 }}
                                    namespace={journey.icon.namespace as ChannelIconTypes['namespace']}
                                />
                            ),
                            text: journey.title,
                            value: journey._id,
                            disabled: !!journey.error,
                        }));
                }
                if (step === 'customized') {
                    return [
                        ...Object.entries(props.enum ?? {}).map(([key, eValue]) => ({
                            value: key,
                            text: eValue,
                            onClick: (e: React.MouseEvent<HTMLLIElement>) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleSelectCustomized(eValue);
                            },
                        })),
                        {
                            text: t('other'),
                            value: 'other',
                            onClick: (e: React.MouseEvent<HTMLLIElement>) => {
                                e.stopPropagation();
                                e.preventDefault();
                                selectRef.current?.close();
                                handleSelectOther();
                            },
                        },
                    ];
                }
                return [];
            }}
            disabled={disabled}
            searchable={queryParams.step !== 'default' && queryParams.step !== 'customized'}
            {...(queryParams.step === 'system' && {
                searchPlaceholder: t('search_by_channel_type_or_journey_type_name'),
            })}
            {...(value && {
                renderValue: () => {
                    const {
                        type,
                        data: { name, type: dataType },
                    } = value;
                    const iconType: Record<API.ProductType, keyof typeof channelIconMapping> = {
                        business_contact_collector: 'crm',
                        email_campaign: 'email',
                        facebook_leads_management: 'facebook',
                        facebook_social_media_management: 'facebook',
                        'ai-assistant_management': 'imbraceai',
                        form_management: 'formManagement',
                        whatsapp_outbound: 'whatsapp',
                    };
                    if (type === 'customized') {
                        return (
                            <EllipsisText
                                text={`${name ?? '—'}`}
                                element={
                                    <Typography
                                        style={{
                                            color: !name ? 'var(--color-light-4)' : 'inherit',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            wordBreak: 'break-word',
                                        }}
                                    />
                                }
                            />
                        );
                    }
                    return (
                        <Space size={12} align="center" justify="start" style={{ width: '100%' }}>
                            <Space>
                                <Icon
                                    namespace="channel"
                                    name={
                                        type === 'channel'
                                            ? (dataType as keyof typeof channelIconMapping)
                                            : iconType[dataType as API.ProductType]
                                    }
                                    style={{ fontSize: 24 }}
                                />
                            </Space>
                            <EllipsisText
                                text={`${name ?? '—'}`}
                                element={
                                    <Typography
                                        style={{
                                            color: !name ? 'var(--color-light-4)' : 'inherit',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            wordBreak: 'break-word',
                                        }}
                                    />
                                }
                            />
                        </Space>
                    );
                },
            })}
            closeOnSelect={false}
            value={value?.data?.id}
            placeholder={t('click_to_select')}
            popoverProps={{
                disablePortal: false,
            }}
            onClose={() => {
                setQueryParams({
                    step: 'default',
                    channelType: 'web',
                });
                if (
                    originalValue.current &&
                    !originalValue.current.data.id?.startsWith('app_') &&
                    !originalValue.current.data.id?.startsWith('ch_') &&
                    !props.enum?.[originalValue.current.data.name || '']
                ) {
                    setMode('input');
                }
            }}
            onReset={() => {
                onChange?.(null);
                setMode('select');
                setQueryParams({
                    step: 'default',
                    channelType: 'web',
                });
            }}
        />
    );
};

export default OriginField;
