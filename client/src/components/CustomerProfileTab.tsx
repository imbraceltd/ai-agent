import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Target, Tag, Circle } from 'lucide-react'
import RecordDetailEnhance from './RecordDetailEnhance'

interface CustomerProfileTabProps {
  board: API.Board
  record: API.BoardItem
  isFetching: boolean
}

const CustomerProfileTab: React.FC<CustomerProfileTabProps> = ({ board, record, isFetching }) => {
  return (
    <RecordDetailEnhance
      board={board}
      record={record}
      refresh={() => Promise.resolve()}
      readOnly
    />
  )
}

export default CustomerProfileTab
