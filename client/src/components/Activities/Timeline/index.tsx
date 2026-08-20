"use client"
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  timelineOppositeContentClasses,
} from "@mui/lab"
import { Paper } from "@mui/material"
import { Typography } from "@imbrace/ui"
import styles from './index.module.scss'

export interface TimelineEvent {
  date: string
  content: string
  status: "negative" | "neutral" | "positive"
}

// Status color mapping
// const getStatusColor = (status: TimelineEvent["status"]) => {
//   switch (status) {
//     case "positive":
//       return "#b8e986"
//     case "neutral":
//       return "#f8cb7f"
//     case "negative":
//       return "#e57373"
//     default:
//       return "#e0e0e0"
//   }
// }

// Component props
interface LoanTimelineProps {
  events: TimelineEvent[]
}

export default function LoanTimeline({ events }: LoanTimelineProps) {
  return (
    <Timeline sx={{
        padding: 0,
        [`& .${timelineOppositeContentClasses.root}`]: {
          flex: 0.3,
        },
      }} position="right" className={styles.timeline}>
      {events.map((event, index) => (
        <TimelineItem key={index} className={styles.timelineItem}>
          <TimelineOppositeContent className={styles.timelineOppositeContent}>
            <Typography
              variant="Body"
              color="primary"
              className={styles.dateLink}
            >
              {event.date}
            </Typography>
          </TimelineOppositeContent>

          <TimelineSeparator  sx={{
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '45%', // Half-width border
              height: '1px',
              backgroundColor: '#E0E0E0', // Border color
            },
          }}>
            <TimelineDot
              className={styles.timelineDot}
              sx={{
                backgroundColor: "#3399FC"
              }}
            />
            
              <TimelineConnector className={styles.timelineConnector} />
          
          </TimelineSeparator>

          <TimelineContent className={styles.timelineContent}>
            <div className={styles.paper}>
              <Typography variant="Body">
                {event.content}
              </Typography>
            </div>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  )
}
