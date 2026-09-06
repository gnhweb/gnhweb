// Bible MBTI: expanded figure set and profile cards.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { notifyUser } from '@/lib/mobileFeedback';

type Axis = 'EI' | 'SN' | 'TF' | 'JP';
type Figure = '다니엘'|'요셉'|'룻'|'바나바'|'베드로'|'느헤미야'|'에스더'|'디모데'|'다윗'|'마리아'|'아브라함'|'모세'|'여호수아'|'사무엘'|'엘리야'|'이사야'|'예레미야'|'바울'|'요한'|'마르다';
type Option = { text:string; side:0|1; figure:Figure };
type Profile = { title:string; era:string; intro:string; story:string; desc:string; strength:string; ref:string; verse:string; practice:string; tone:string };
