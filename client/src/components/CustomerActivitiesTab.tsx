import React from 'react'
import Activities from './Activities'

interface CustomerActivitiesTabProps {
  board: API.Board
  record: API.BoardItem
  isFetching: boolean
}


const CustomerActivitiesTab: React.FC<CustomerActivitiesTabProps> = ({ board, record, isFetching }) => {
  return (
   <Activities userId={record?.contacts?._id as string} />
  )
}

export default CustomerActivitiesTab
