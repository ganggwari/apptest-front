<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { aiVoices, koreanVoices, saveVoiceName, savedVoiceName, speakNavigation, speechSupported, stopNavigationSpeech } from '../utils/navigation-voice'
const voices = ref<SpeechSynthesisVoice[]>([]),
  selected = ref(savedVoiceName())
// 목소리 목록은 늦게 들어오는 브라우저가 있어서 voiceschanged 때 다시 읽는다
function loadVoices() { voices.value = koreanVoices() }
function change() { saveVoiceName(selected.value) }
function preview() { void speakNavigation('300미터 앞에서 우회전입니다.', selected.value) }
onMounted(() => {
  loadVoices()
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
        <optgroup label="AI 목소리">
          <option v-for="voice in aiVoices" :key="voice.name" :value="`ai:${voice.name}`">{{voice.label}}</option>
        </optgroup>
        <optgroup label="기기 목소리">
          <option value="">자동 (추천 목소리)</option>
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">{{voice.name}}</option>
        </optgroup>
      </select>
    </label>
    <small>AI 목소리는 인터넷 연결이 필요하며, 연결이 안 되면 기기 목소리로 안내합니다.</small>
    <button type="button" @click="preview">미리 듣기</button>
  </section>
</template>
<style scoped>
.navigation-voice-settings label { display:flex; flex-direction:column; gap:8px; max-width:500px; }
.navigation-voice-settings small { display:block; margin-top:8px; color:var(--muted, #6b7280); }
.navigation-voice-settings button { margin-top:12px; }
</style>
