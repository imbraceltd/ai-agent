import type { SelectRef } from '@imbrace/ui';
import { EllipsisText, FieldSelect, Icon, IconButton, Space } from '@imbrace/ui';
import { styled } from '@mui/material';
import MuiChip from '@mui/material/Chip';
import { useRef, useState } from 'react';
import Scrollbars from 'react-custom-scrollbars';
import { useTranslation } from 'react-i18next';

import { getForms, getOrgJourneys } from '@/services/api/app';
import { getChannelList } from '@/services/api/channel';
import apiFetch from '@/services/axios/handler';

interface OriginFilterFieldProps {
    value: API.OriginValue[];
    onChange: (data: API.OriginValue) => void;
    enum?: Record<string | number, string>;
    disabled?: boolean;
    onDelete: (id: string) => void;
    onReset: () => void;
}
const fetchChannel = async (channelType: API.ChannelType) => {
    const { data } = await apiFetch<API.PaginatedResponse<API.Channel[]>>(getChannelList.api(channelType), getChannelList.method);

    return data.data;
};
const fetchJourney = async () => {
    const { data } = await apiFetch<{ data: API.Journey[] }>(getOrgJourneys.api, getOrgJourneys.method);

    return data.data;
};

const Chip = styled(MuiChip, { shouldForwardProp: (propName) => propName !== 'selected' && propName !== 'disabled' })<{
    selected?: boolean;
    disabled?: boolean;
}>(({ selected, disabled }: { selected?: boolean; disabled?: boolean }) => ({
    height: 24,
    background: selected ? '#FA991733' : 'var(--color-primary-3)',
    ...(disabled && {
        background: 'var(--color-light-3)',
        color: 'var(--color-light-4)',
    }),
    position: 'relative',
    fontSize: '0.875rem',
    '& svg': {
        display: 'inline-block',
        fontSize: 24,
        marginLeft: '12px',
        color: 'var(--color-light-5)',
        ...(disabled && {
            color: 'var(--color-light-4)',
        }),
    },
}));

const OriginFilterField = (props: OriginFilterFieldProps) => {
    const { value, onChange, disabled, onDelete, onReset } = props;
    const selectRef = useRef<SelectRef>(null);
    const { t } = useTranslation();

    const [queryParams, setQueryParams] = useState<{ step: string; channelType?: API.ChannelType; journeyType?: API.ProductType }>({
        step: 'default',
        channelType: 'web',
        journeyType: 'business_contact_collector',
    });
    // const [mode, setMode] = useState<'select' | 'input'>('select');

    const handleSelectChannel = (channel: API.Channel) => {
        onChange?.({
            type: 'channel',
            data: {
                id: channel.id,
                name: channel.name,
                type: channel.config.type,
            },
        });
        // selectRef.current?.close();
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
        // selectRef.current?.close();
    };

    const handleSelectForm = (form: FormManagement.Form) => {
        onChange?.({
            type: 'journey',
            data: {
                id: form._id,
                name: `Form Management - ${form.name}`,
                type: 'form_management',
            },
        });
        // selectRef.current?.close();
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
        // selectRef.current?.close();
    };

    // const handleSelectOther = () => {
    //     setMode('input');
    // };

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

    // if (mode === 'input') {
    //     return (
    //         <FieldText
    //             fullWidth
    //             onReset={() => {
    //                 setMode('select');
    //                 setQueryParams({
    //                     step: 'default',
    //                     channelType: 'web',
    //                 });
    //             }}
    //         />
    //     );
    // }

    return (
        <FieldSelect<string[], ['origin-field-filter', { step: string; channelType?: API.ChannelType; journeyType?: API.ProductType }]>
            queryKey={['origin-field-filter', queryParams]}
            ref={selectRef}
            fullWidth
            formControlSx={{
                width: '100%',
                minWidth: '200px',
            }}
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
                            asChip: false,
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
                            asChip: false,
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
                            value: t('channel_web'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'web',
                                });
                            },
                            asChip: false,
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
                            value: t('channel_facebook'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'facebook',
                                });
                            },
                            asChip: false,
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
                            value: t('channel_whatsapp'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'whatsapp',
                                });
                            },
                            asChip: false,
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
                            value: t('channel_wechat'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'wechat',
                                });
                            },
                            asChip: false,
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
                            value: t('channel_line'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'channel',
                                    channelType: 'line',
                                });
                            },
                            asChip: false,
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
                            value: t('journey_business_contact_collector_title'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'business_contact_collector',
                                });
                            },
                            asChip: false,
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
                            value: t('journey_form_management_title'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'form_management',
                                });
                            },
                            asChip: false,
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
                            value: t('journey_facebook_social_media_management_title'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'facebook_social_media_management',
                                });
                            },
                            asChip: false,
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
                            value: t('journey_facebook_leads_management_title'),
                            onClick: () => {
                                setQueryParams({
                                    step: 'journey',
                                    journeyType: 'facebook_leads_management',
                                });
                            },
                            asChip: false,
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
                        text: channel.name,
                        value: channel.id,
                        // disabled: channel.is_init || 'errorCode' in channel,
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
                                handleSelectJourney(journey);
                            },
                            text: journey.title,
                            value: journey._id,
                            // disabled: !!journey.error,
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
                            value: 'Other',
                            onClick: (e: React.MouseEvent<HTMLLIElement>) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleSelectCustomized('Other');
                            },
                        },
                    ];
                }
                return [];
            }}
            searchable={queryParams.step !== 'default'}
            {...(queryParams.step === 'system' && {
                searchPlaceholder: t('search_by_channel_or_journey_type_name'),
            })}
            multiple
            displayType="chip"
            menuType="chip"
            chipWrap
            disabled={disabled}
            {...(value && {
                renderValue: () => {
                    return (
                        <Space size={8} style={{ width: '100%', overflow: 'hidden', lineHeight: '20px' }}>
                            <Scrollbars
                                autoHeight
                                autoHeightMax={56}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    maxHeight: '56px',
                                }}
                                autoHide
                            >
                                <Space size={8} wrap>
                                    {value.map((item) => {
                                        const {
                                            data: { name, id },
                                        } = item;

                                        return (
                                            <Chip
                                                label={name}
                                                onDelete={() => {
                                                    onDelete(id as string);
                                                }}
                                                selected
                                                sx={{
                                                    '& .MuiChip-label': {
                                                        paddingRight: '24px',
                                                    },
                                                }}
                                                deleteIcon={
                                                    <Icon
                                                        name="close"
                                                        onMouseDown={(event) => event.stopPropagation()}
                                                        style={{
                                                            margin: 0,
                                                            fontSize: 12,
                                                            color: disabled ? 'var(--color-light-4)' : '#FA9917CC',
                                                            position: 'absolute',
                                                            right: '8px',
                                                        }}
                                                    />
                                                }
                                            />
                                        );
                                    })}
                                </Space>
                            </Scrollbars>
                        </Space>
                    );
                },
            })}
            customIcon={(open) => (
                <Icon
                    name="add"
                    fontSize={20}
                    style={{
                        // display: open ? 'none' : undefined,
                        userSelect: 'none',
                        pointerEvents: 'none',
                        color: 'var(--color-light-4)',
                    }}
                />
            )}
            closeOnSelect={false}
            value={value?.map((item) => item.data.id as string) || []}
            hideSelectedItem
            // placeholder={t('click_to_select')}
            popoverProps={{
                disablePortal: false,
            }}
            onClose={() => {
                setQueryParams({
                    step: 'default',
                    channelType: 'web',
                });
            }}
            {...(Array.isArray(value) &&
                value.length > 0 && {
                    customIcon: () => (
                        <IconButton
                            variant="text"
                            type="secondary"
                            size="xs"
                            onClick={() => {
                                onReset();
                            }}
                        >
                            <Icon name="close" fontSize={20} />
                        </IconButton>
                    ),
                })}
        />
    );
};

export default OriginFilterField;
