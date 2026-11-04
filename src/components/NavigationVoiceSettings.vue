<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { aiVoices, voiceStatus, initVoice, koreanVoices, saveVoiceName, savedVoiceName, speakNavigation, speechSupported, stopNavigationSpeech } from '../utils/navigation-voice'
const voices = ref<SpeechSynthesisVoice[]>([]),
  selected = ref(savedVoiceName())
// 목소리 목록은 늦게 들어오는 브라우저가 있어서 voiceschanged 때 다시 읽는다
function loadVoices() { voices.value = koreanVoices() }
function change() { saveVoiceName(selected.value) }
function preview() { void speakNavigation('300미터 앞에서 우회전해 주세요.', selected.value) }
onMounted(() => {
  void initVoice().then(loadVoices)
  if (speechSupported) speechSynthesis.addEventListener('voiceschanged', loadVoices)
})
onBeforeUnmount(() => {
  if (speechSupported) speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  stopNavigationSpeech()
})
</script>
<template>
  <section class="account-panel navigation-voice-settings">
    <h2>내비</h2>
    <label>안내 음성
      <select v-model="selected" @change="change">
        <optgroup label="남성 AI 목소리"><option v-for="voice in aiVoices" :key="voice.name" :value="`ai:${voice.name}`">{{voice.label}}</option></optgroup>
        <optgroup label="기기 목소리">
          <option value="">자동 (기기 한국어 음성)</option>
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">{{voice.name}}</option>
        </optgroup>
      </select>
    </label>
    <small>기본은 남성 Charon 음성입니다. AI 음성은 인터넷 연결이 필요하며, 준비가 늦어도 다른 목소리로 바꾸지 않습니다.</small>
    <small v-if="!selected.startsWith(`ai:`) && voiceStatus.status===`no-engine`">이 환경에서는 음성 안내를 사용할 수 없습니다.</small><small v-else-if="!selected.startsWith(`ai:`) && voiceStatus.status===`no-korean`">기기에 한국어 음성을 설치해 주세요.</small><small v-if="voiceStatus.lastError" role="status">{{voiceStatus.lastError}}</small>
    <button type="button" :disabled="!selected.startsWith('ai:') && !speechSupported" @click="preview">미리 듣기</button>
  </section>
</template>
<style scoped>
.navigation-voice-settings label { display:flex; flex-direction:column; gap:8px; max-width:500px; }
.navigation-voice-settings small { display:block; margin-top:8px; color:var(--muted, #6b7280); }
.navigation-voice-settings button { margin-top:12px; }
</style>
