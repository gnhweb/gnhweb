import EventReportDetail from './page';
import ReportOwnerActions from '../ownerActions';
import { useParams } from 'react-router-dom';
export default function HumanEventDetail(){const {id}=useParams();return <><EventReportDetail/><ReportOwnerActions reportType="event" reportId={id||''}/></>}
