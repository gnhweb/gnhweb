import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as KakaoMap, MapMarker, Circle, useKakaoLoader } from 'react-kakao-maps-sdk';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';

const KAKAO_MAP_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string;

interface AttendanceLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

interface LocationLog {
  id: string;
  location_label: string;
  action: string;
  changed_by_name: string;
  old_label: string | null;
  new_label: string | null;
  old_latitude: number | null;
  old_longitude: number | null;
  new_latitude: number | null;
  new_longitude: number | null;
  old_radius_meters: number | null;
  new_radius_meters: number | null;
  created_at: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: LatLng = { lat: 37.7510, lng: 128.8760 };
const DEFAULT_LEVEL = 3; // 카카오맵 확대 수준: 숫자가 작을수록 더 확대됨
const MIN_RADIUS = 30;
const MAX_RADIUS = 500;

interface SearchResult {
  id: string;
  place_name: string;
  address_name: string;
  lat: number;
  lng: number;
}

export default function AttendanceLocationPage() {
  const { profile } = useAuth();
  const isAdmin = profile ? ROLE_HIERARCHY[profile.role] >= ROLE_HIERARCHY.teacher : false;

  const [mapLoading, mapLoadError] = useKakaoLoader({
    appkey: KAKAO_MAP_APP_KEY,
    libraries: ['services'],
  });

  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [markerPos, setMarkerPos] = useState<LatLng>(DEFAULT_CENTER);
  const [radius, setRadius] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [mapLevel, setMapLevel] = useState(DEFAULT_LEVEL);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Tab
  const [tab, setTab] = useState<'locations' | 'logs'>('locations');

  // Separate form open state to prevent form from disappearing when typing
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_locations')
        .select('*')
        .order('updated_at', { ascending: true });

      if (error) throw error;
      setLocations((data as AttendanceLocation[]) || []);
    } catch (err) {
      console.error('위치 정보 로딩 실패:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('attendance_location_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs((data as LocationLog[]) || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchLogs();
  }, [fetchLocations, fetchLogs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setMarkerPos(DEFAULT_CENTER);
    setMapCenter(DEFAULT_CENTER);
    setMapLevel(DEFAULT_LEVEL);
    setRadius(100);
    setIsActive(true);
    setErrorMsg('');
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (loc: AttendanceLocation) => {
    setEditingId(loc.id);
    setLabel(loc.label);
    setMarkerPos({ lat: loc.latitude, lng: loc.longitude });
    setMapCenter({ lat: loc.latitude, lng: loc.longitude });
    setMapLevel(2);
    setRadius(loc.radius_meters);
    setIsActive(loc.is_active);
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q || mapLoading || typeof kakao === 'undefined') return;
    setIsSearching(true);
    setErrorMsg('');

    const places = new kakao.maps.services.Places();
    places.keywordSearch(q, (data, status) => {
      setIsSearching(false);
      if (status === kakao.maps.services.Status.OK) {
        const results: SearchResult[] = data.map((item) => ({
          id: item.id,
          place_name: item.place_name,
          address_name: item.road_address_name || item.address_name,
          lat: parseFloat(item.y),
          lng: parseFloat(item.x),
        }));
        setSearchResults(results);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setErrorMsg('검색 결과가 없어요.');
      }
    });
  }, [searchQuery, mapLoading]);

  const selectSearchResult = (result: SearchResult) => {
    setMarkerPos({ lat: result.lat, lng: result.lng });
    setMapCenter({ lat: result.lat, lng: result.lng });
    setMapLevel(2);
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMarkerPos({ lat, lng });
  }, []);

  const logChange = async (locationId: string | null, action: string, oldData?: Partial<AttendanceLocation>, newData?: Partial<AttendanceLocation>) => {
    try {
      await supabase.from('attendance_location_logs').insert({
        location_id: locationId,
        location_label: newData?.label || oldData?.label || '',
        action,
        changed_by: profile!.user_id,
        changed_by_name: profile!.name,
        old_label: oldData?.label || null,
        new_label: newData?.label || null,
        old_latitude: oldData?.latitude || null,
        old_longitude: oldData?.longitude || null,
        old_radius_meters: oldData?.radius_meters || null,
        new_latitude: newData?.latitude || null,
        new_longitude: newData?.longitude || null,
        new_radius_meters: newData?.radius_meters || null,
      });
      fetchLogs();
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setErrorMsg('위치 이름을 입력해주세요.');
      return;
    }
    if (trimmedLabel.length > 50) {
      setErrorMsg('위치 이름은 50자 이내로 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        label: trimmedLabel,
        latitude: markerPos.lat,
        longitude: markerPos.lng,
        radius_meters: radius,
        is_active: isActive,
        updated_by: profile!.user_id,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const oldLocation = locations.find(l => l.id === editingId);
        const { error } = await supabase
          .from('attendance_locations')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;

        await logChange(editingId, 'update', {
          label: oldLocation?.label,
          latitude: oldLocation?.latitude,
          longitude: oldLocation?.longitude,
          radius_meters: oldLocation?.radius_meters,
        }, payload);

        setSuccessMsg('위치가 수정되었어요!');
      } else {
        const { data, error } = await supabase
          .from('attendance_locations')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;

        if (data) {
          await logChange(data.id, 'create', undefined, payload);
        }

        setSuccessMsg('새 위치가 등록되었어요!');
      }

      setTimeout(() => setSuccessMsg(''), 3000);
      resetForm();
      fetchLocations();
    } catch (err) {
      console.error('저장 실패:', err);
      setErrorMsg('저장 중 오류가 발생했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (loc: AttendanceLocation) => {
    const newActive = !loc.is_active;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('attendance_locations')
        .update({ is_active: newActive, updated_at: new Date().toISOString(), updated_by: profile!.user_id })
        .eq('id', loc.id);
      if (error) throw error;

      await logChange(loc.id, newActive ? 'activate' : 'deactivate', { label: loc.label }, { label: loc.label });
      setSuccessMsg(`'${loc.label}' 위치가 ${newActive ? '활성화' : '비활성화'}되었어요.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchLocations();
    } catch {
      setErrorMsg('상태 변경 중 오류가 발생했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (loc: AttendanceLocation) => {
    if (!window.confirm(`'${loc.label}' 위치를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setIsSaving(true);
    try {
      await logChange(loc.id, 'delete', { label: loc.label, latitude: loc.latitude, longitude: loc.longitude, radius_meters: loc.radius_meters });

      const { error } = await supabase
        .from('attendance_locations')
        .delete()
        .eq('id', loc.id);
      if (error) throw error;

      setSuccessMsg(`'${loc.label}' 위치가 삭제되었어요.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (editingId === loc.id) resetForm();
      fetchLocations();
    } catch {
      setErrorMsg('삭제 중 오류가 발생했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = locations.filter(l => l.is_active).length;

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-2xl text-rose-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없어요</p>
          <p className="text-sm text-foreground-500">교사 또는 부장만 접근할 수 있는 페이지예요</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500 block mb-3"></i>
          <p className="text-sm text-foreground-500">위치 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">출석 위치 설정</h1>
            <p className="text-sm text-foreground-500">
              여러 출석 위치를 등록하고 활성화할 수 있어요 · 현재 <strong className="text-emerald-600">{activeCount}개</strong> 활성
            </p>
          </div>
          <Link
            to="/dashboard/attendance"
            className="flex items-center gap-2 px-5 py-2.5 bg-background-100 border border-background-200 rounded-2xl text-sm font-bold text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-lg"></i>
            출석 현황
          </Link>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <i className="ri-check-line mr-2"></i>{successMsg}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
              <i className="ri-error-warning-line mr-2"></i>{errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-5 px-1 py-1 rounded-full bg-background-200/70 w-fit">
          <button onClick={() => setTab('locations')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'locations' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}>
            위치 목록 ({locations.length})
          </button>
          <button onClick={() => setTab('logs')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${tab === 'logs' ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-800'}`}>
            변경 이력 ({logs.length})
          </button>
        </div>

        {/* Locations tab */}
        {tab === 'locations' && (
          <>
            {/* Create button */}
            <div className="mb-4">
              <button
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i>새 위치 등록
              </button>
            </div>

            {/* Location cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {locations.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                    <i className="ri-map-pin-line text-2xl text-foreground-400"></i>
                  </div>
                  <p className="text-sm text-foreground-500">등록된 출석 위치가 없어요</p>
                </div>
              )}
              {locations.map(loc => (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-background-100 border rounded-2xl p-4 transition-colors ${loc.is_active ? 'border-emerald-200' : 'border-background-200 opacity-60'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${loc.is_active ? 'bg-emerald-100' : 'bg-background-200'}`}>
                        <i className={`ri-map-pin-line ${loc.is_active ? 'text-emerald-600' : 'text-foreground-400'}`}></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground-950">{loc.label}</h3>
                        <p className="text-xs text-foreground-500">반경 {loc.radius_meters}m · ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)})</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${loc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {loc.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditForm(loc)}
                      className="flex-1 px-3 py-2 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold hover:bg-primary-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                    <button
                      onClick={() => handleToggleActive(loc)}
                      disabled={isSaving}
                      className="flex-1 px-3 py-2 rounded-full bg-background-50 border border-background-200 text-foreground-600 text-xs font-medium hover:bg-background-200 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    >
                      <i className={`${loc.is_active ? 'ri-toggle-line' : 'ri-toggle-fill'} mr-1`}></i>
                      {loc.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      disabled={isSaving}
                      className="px-3 py-2 rounded-full bg-rose-50 text-rose-500 text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Edit/Create Form */}
            <AnimatePresence>
              {isFormOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {(
                    <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground-950">
                          {editingId ? `'${label}' 수정` : '새 위치 등록'}
                        </h3>
                        {editingId && (
                          <button onClick={resetForm} className="text-xs text-foreground-500 hover:text-foreground-700 cursor-pointer">
                            취소
                          </button>
                        )}
                      </div>

                      {/* Label + Active toggle */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-1 w-full">
                          <label className="text-xs font-semibold text-foreground-500 mb-1.5 block">위치 이름</label>
                          <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="예: 학관 본관, 별관 2층"
                            maxLength={50}
                            className="w-full px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-primary-300 transition-colors"
                            disabled={isSaving}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <label className="text-xs font-semibold text-foreground-500">활성화</label>
                          <button
                            onClick={() => setIsActive(!isActive)}
                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-emerald-400' : 'bg-background-300'}`}
                          >
                            <motion.div
                              animate={{ x: isActive ? 20 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="w-5 h-5 rounded-full bg-background-100 shadow-sm absolute top-0.5"
                            ></motion.div>
                          </button>
                        </div>
                      </div>

                      {/* Search */}
                      <div ref={searchRef}>
                        <label className="text-xs font-semibold text-foreground-500 mb-1.5 block">주소 검색</label>
                        <div className="flex items-center gap-2 relative">
                          <div className="flex-1 relative">
                            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                              placeholder="예: 강릉시, 강릉 학관"
                              className="w-full pl-10 pr-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-primary-300 transition-colors"
                              disabled={isSaving}
                            />
                          </div>
                          <button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} className="px-5 py-3 bg-secondary-500 hover:bg-secondary-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap">
                            {isSearching ? <i className="ri-loader-4-line animate-spin"></i> : '검색'}
                          </button>
                        </div>
                        <AnimatePresence>
                          {showResults && searchResults.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute z-[1000] mt-2 w-full max-w-2xl bg-background-100 border border-background-200 rounded-xl shadow-lg overflow-hidden" style={{ maxWidth: 'calc(100% - 3rem)' }}>
                              {searchResults.map((r) => (
                                <button key={r.id} onClick={() => selectSearchResult(r)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-foreground-700 hover:bg-background-50 transition-colors cursor-pointer border-b border-background-100 last:border-0">
                                  <i className="ri-map-pin-line text-primary-500 flex-shrink-0"></i>
                                  <span className="truncate">
                                    <span className="font-medium">{r.place_name}</span>
                                    {r.address_name && <span className="text-foreground-400"> · {r.address_name}</span>}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Map */}
                      <div className="rounded-xl overflow-hidden border border-background-200 relative" style={{ height: '350px' }}>
                        {mapLoadError ? (
                          <div className="w-full h-full flex items-center justify-center text-sm text-rose-500 bg-background-50">
                            지도를 불러오지 못했어요. 카카오맵 API 키를 확인해주세요.
                          </div>
                        ) : mapLoading ? (
                          <div className="w-full h-full flex items-center justify-center text-sm text-foreground-400 bg-background-50">
                            <i className="ri-loader-4-line animate-spin mr-2"></i>지도를 불러오는 중...
                          </div>
                        ) : (
                          <KakaoMap
                            center={mapCenter}
                            level={mapLevel}
                            isPanto={true}
                            style={{ height: '100%', width: '100%' }}
                            onClick={(_target, mouseEvent) => {
                              handleMapClick(mouseEvent.latLng.getLat(), mouseEvent.latLng.getLng());
                            }}
                          >
                            <MapMarker
                              position={markerPos}
                              draggable={true}
                              onDragEnd={(marker) => {
                                const pos = marker.getPosition();
                                setMarkerPos({ lat: pos.getLat(), lng: pos.getLng() });
                              }}
                            />
                            <Circle
                              center={markerPos}
                              radius={radius}
                              strokeWeight={2}
                              strokeColor="#f43f5e"
                              strokeOpacity={0.8}
                              strokeStyle="dash"
                              fillColor="#f43f5e"
                              fillOpacity={0.12}
                            />
                          </KakaoMap>
                        )}
                      </div>

                      {/* Radius */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-bold text-foreground-800">허용 반경</p>
                            <p className="text-xs text-foreground-500">이 반경 안에 있어야 출석 인증 가능</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-extrabold text-primary-600">{radius}</span>
                            <span className="text-sm text-foreground-500">m</span>
                          </div>
                        </div>
                        <input type="range" min={MIN_RADIUS} max={MAX_RADIUS} step={10} value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-background-200 cursor-pointer" style={{ accentColor: 'oklch(0.58 0.18 350)', background: `linear-gradient(to right, oklch(0.58 0.18 350) 0%, oklch(0.58 0.18 350) ${((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100}%, oklch(0.93 0.01 260) ${((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100}%, oklch(0.93 0.01 260) 100%)` }} />
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {[50, 100, 150, 200, 300].map((r) => (
                            <button key={r} onClick={() => setRadius(r)} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${radius === r ? 'bg-primary-500 text-white' : 'bg-background-50 text-foreground-600 hover:bg-background-200'}`}>{r}m</button>
                          ))}
                        </div>
                      </div>

                      {/* Save */}
                      <div className="flex items-center gap-3">
                        <button onClick={handleSave} disabled={isSaving || !label.trim()} className="flex-1 sm:flex-none px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap">
                          {isSaving ? (<span className="flex items-center gap-2"><i className="ri-loader-4-line animate-spin"></i>저장 중...</span>) : (<span className="flex items-center gap-2"><i className="ri-save-line"></i>{editingId ? '수정하기' : '등록하기'}</span>)}
                        </button>
                        {editingId && (
                          <button onClick={resetForm} className="px-5 py-3 bg-background-50 border border-background-200 text-foreground-600 text-sm rounded-xl hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap">취소</button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info */}
            <div className="bg-accent-50 border border-accent-200 rounded-[20px] p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-information-line text-accent-600 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-accent-800 mb-1">다중 위치 관리 안내</p>
                  <ul className="text-xs text-accent-700 space-y-1.5">
                    <li>• 여러 출석 위치(본관, 별관, 야외 등)를 동시에 등록·관리할 수 있어요.</li>
                    <li>• 활성화된 모든 위치 중 어느 하나의 반경 안에만 있어도 출석 인증이 가능해요.</li>
                    <li>• 위치별로 다른 반경을 설정할 수 있어요 (건물 내부 50m, 야외 200m 등).</li>
                    <li>• 위치 변경 이력은 '변경 이력' 탭에서 확인할 수 있어요.</li>
                    <li>• 지도는 카카오맵을 사용해요. 검색창에 건물명이나 주소를 입력해 위치를 빠르게 찾을 수 있어요.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Logs tab */}
        {tab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-history-line text-2xl text-foreground-400"></i>
                </div>
                <p className="text-sm text-foreground-500">아직 변경 이력이 없어요</p>
              </div>
            ) : (
              logs.map(log => {
                const actionLabel = log.action === 'create' ? '등록' : log.action === 'update' ? '수정' : log.action === 'delete' ? '삭제' : log.action === 'activate' ? '활성화' : '비활성화';
                const actionColor = log.action === 'create' || log.action === 'activate' ? 'bg-emerald-100 text-emerald-700' : log.action === 'delete' || log.action === 'deactivate' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                return (
                  <div key={log.id} className="bg-background-100 border border-background-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${actionColor}`}>{actionLabel}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-800 truncate">{log.location_label || '(이름 없음)'}</p>
                      <p className="text-xs text-foreground-500">
                        {log.changed_by_name} · {new Date(log.created_at).toLocaleString('ko-KR')}
                        {log.old_label && log.new_label && log.old_label !== log.new_label && ` · 이름: ${log.old_label} → ${log.new_label}`}
                        {log.old_latitude && log.new_latitude && (log.old_latitude !== log.new_latitude || log.old_longitude !== log.new_longitude) && ' · 위치 변경됨'}
                        {log.old_radius_meters && log.new_radius_meters && log.old_radius_meters !== log.new_radius_meters && ` · 반경: ${log.old_radius_meters}m → ${log.new_radius_meters}m`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
