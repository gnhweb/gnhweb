import WeeklyReportDetail from './page';
import ReportOwnerActions from '../ownerActions';
import { useParams } from 'react-router-dom';
export default function HumanWeeklyDetail(){const {id}=useParams();return <><WeeklyReportDetail/><ReportOwnerActions reportType="weekly" reportId={id||''}/></>}
