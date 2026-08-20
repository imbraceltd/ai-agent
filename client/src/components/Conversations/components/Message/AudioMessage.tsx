import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WaveSurfer from 'wavesurfer.js';

// import CursorPlugin from 'wavesurfer.js/src/plugin/cursor';
import styles from './index.module.scss';
import UnsupportedMessage from './UnsupportedMessage';

interface AudioMessageProps {
    audioUrl?: string;
}

const AudioMessage: FC<AudioMessageProps> = (props) => {
    const { audioUrl } = props;
    const { t } = useTranslation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState('00:00');
    const [error, setError] = useState(false);
    const wavesurferRef = useRef<WaveSurfer>();
    const durationRef = useRef<ReturnType<typeof setInterval>>();
    const containerRef = useRef<HTMLDivElement>(null);

    const togglePlayAudio = () => {
        wavesurferRef.current?.play();
    };

    const getDuration = useCallback(() => {
        setCurrentTime(new Date((wavesurferRef.current?.getCurrentTime() || 0) * 1000).toISOString().substring(14, 19));
    }, []);

    useEffect(() => {
        if (audioUrl && containerRef.current) {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
            wavesurferRef.current = WaveSurfer.create({
                container: containerRef.current,
                waveColor: '#ffcccc',
                progressColor: '#ff4343',
                cursorColor: '#4353FF',
                barWidth: 3,
                barRadius: 5,
                cursorWidth: 0,
                height: 40,
                barGap: 4,
                barMinHeight: 1,
                normalize: true,
                interact: false,
                // plugins: [
                //     CursorPlugin.create({
                //         color: '#ffa09b',
                //         showTime: true,
                //         opacity: '0.8',
                //         customShowTimeStyle: {
                //             'background-color': '#4770ff',
                //             color: '#fff',
                //             padding: '2px',
                //             'font-size': '10px',
                //             // transform: 'translateY(-50%)',
                //         },
                //     }),
                // ],
            });
            wavesurferRef.current?.load(audioUrl, undefined, 'auto');

            wavesurferRef.current?.on('error', (e) => {
                console.warn(e);
                setError(true);
            });
            wavesurferRef.current?.on('play', () => {
                setIsPlaying(true);
            });
            wavesurferRef.current?.on('pause', () => {
                setIsPlaying(false);
            });
        }
        return () => {
            wavesurferRef.current?.unAll();
            wavesurferRef.current?.destroy();
        };
    }, [audioUrl, containerRef]);

    useEffect(() => {
        if (isPlaying) {
            if (durationRef.current) {
                clearInterval(durationRef.current);
            }
            durationRef.current = setInterval(() => {
                getDuration();
            }, 10);
        } else if (durationRef.current) {
            clearInterval(durationRef.current);
        }
    }, [isPlaying, getDuration]);

    if (error) {
        return <UnsupportedMessage text={t('unsupported_audio')} />;
    }

    return (
        <div className={styles.messageContentAudioRoot}>
            <IconButton onClick={() => togglePlayAudio()}>{isPlaying ? <PauseIcon /> : <PlayArrowIcon />}</IconButton>
            <div ref={containerRef} style={{ height: 40, width: 200 }}></div>
            <Typography variant="caption">{currentTime}</Typography>
        </div>
    );
};

export default AudioMessage;
