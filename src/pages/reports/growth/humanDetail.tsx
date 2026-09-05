import GrowthRecordDetail from './detail/page';
import ReportOwnerActions from '../ownerActions';
import { useParams } from 'react-router-dom';
export default function HumanGrowthDetail(){const {id}=useParams();return <><GrowthRecordDetail/><ReportOwnerActions reportType="growth" reportId={id||''}/></>}
