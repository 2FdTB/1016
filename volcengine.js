/**
 * SillyTavern TTS Provider for Volcengine (Doubao Speech)
 * 使用新版控制台 API Key 鉴权 (X-Api-Key)
 */

import { registerTtsProvider } from './index.js'; // 假设 index.js 导出此函数，按实际路径调整

class VolcengineTtsProvider {
    constructor() {
        this.name = 'volcengine';
        this.settings = {};
        this.voices = [
            // 这里预置几个常见音色，也可留空让用户手动输入
            { name: '小何 (女声)', voice_id: 'zh_female_xiaohe_uranus_bigtts' },
            { name: '刘飞 (男声)', voice_id: 'zh_male_liufei_uranus_bigtts' },
            { name: '温柔小雅 (女声)', voice_id: 'zh_female_wenrouxiaoya_uranus_bigtts' },
        ];
    }

    /**
     * 必须实现：生成 TTS
     * @param {string} text - 待合成的文本
     * @param {string} voiceId - 音色 ID
     * @returns {Promise<Blob>} 音频 Blob
     */
    async generateTts(text, voiceId) {
        const apiKey = this.settings.api_key;
        if (!apiKey) {
            throw new Error('Volcengine TTS: Missing API Key in settings.');
        }

        // 火山 TTS V3 单向流式接口
        const url = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

        // 根据 livekit 插件的默认值推断 resource_id，也可让用户在设置中覆盖
        let resourceId = this.settings.resource_id;
        if (!resourceId) {
            // 简易推断：声音复刻音色以 S_ 或 ICL_ 开头，否则默认为 seed-tts-2.0
            if (voiceId.startsWith('S_') || voiceId.startsWith('ICL_')) {
                resourceId = 'seed-icl-2.0';
            } else {
                resourceId = 'seed-tts-2.0';
            }
        }

        // 构建请求体
        const payload = {
            user: {
                uid: "sillytavern_user"
            },
            req_params: {
                text: text,
                speaker: voiceId,
                audio_params: {
                    format: "mp3",
                    sample_rate: 24000
                }
            }
        };

        // 可选：如果用户设置了语速等参数，可以在这里合并
        // 注意：新版接口的字段名可能为 speech_rate 等，具体参考控制台文档
        if (this.settings.speed !== undefined && this.settings.speed !== 1.0) {
            // 假设用户输入的是 OpenAI 风格的倍率 (1.0 = 正常)
            // 火山原生 speech_rate: 0-100, 50 为正常? 或者 -50 到 100?
            // 参考 livekit 插件：speech_rate = round((speed - 1.0) * 200) 大概映射
            const rate = Math.round((this.settings.speed - 1.0) * 200);
            payload.req_params.speech_rate = Math.max(-50, Math.min(100, rate));
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'X-Api-Request-Id': crypto.randomUUID(),
            'X-Api-Resource-Id': resourceId,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Volcengine TTS Error: ${response.status} - ${errorText}`);
        }

        // 接口返回的是流式二进制，直接取 blob
        const audioBlob = await response.blob();

        // 确保类型是音频
        return new Blob([audioBlob], { type: 'audio/mpeg' });
    }

    /**
     * 必须实现：获取音色列表
     * 目前硬编码返回，如需动态获取需调用 ListVoices 接口
     */
    async fetchTtsVoiceObjects() {
        return this.voices;
    }

    /**
     * 必须实现：返回设置 HTML
     */
    get settingsHtml() {
        return `
        <div class="tts_provider_settings">
            <div class="flex-container">
                <label for="volcengine_api_key">API Key (新版控制台):</label>
                <input type="password" id="volcengine_api_key" class="text_pole" value="${this.settings.api_key || ''}">
            </div>
            <div class="flex-container">
                <label for="volcengine_resource_id">Resource ID (可选):</label>
                <input type="text" id="volcengine_resource_id" class="text_pole" value="${this.settings.resource_id || ''}" placeholder="留空自动推断 (seed-tts-2.0)">
            </div>
            <div class="flex-container">
                <label for="volcengine_speed">语速 (1.0 = 正常):</label>
                <input type="number" id="volcengine_speed" class="text_pole" value="${this.settings.speed || 1.0}" step="0.1" min="0.2" max="3.0">
            </div>
            <small>API Key 从火山引擎语音技术控制台获取。新版鉴权无需 AppID/AccessKey。</small>
        </div>
        `;
    }

    /**
     * 必须实现：加载设置
     */
    loadSettings(settings) {
        this.settings = settings || {};
    }

    /**
     * 必须实现：保存设置（从 HTML 读入）
     */
    onSettingsChange() {
        // 这个方法通常由外部触发，或者我们在 save 时手动调用
        // 具体取决于 SillyTavern TTS 扩展的调用方式
        const apiKeyInput = document.getElementById('volcengine_api_key');
        const resourceIdInput = document.getElementById('volcengine_resource_id');
        const speedInput = document.getElementById('volcengine_speed');

        if (apiKeyInput) this.settings.api_key = apiKeyInput.value.trim();
        if (resourceIdInput) this.settings.resource_id = resourceIdInput.value.trim();
        if (speedInput) this.settings.speed = parseFloat(speedInput.value) || 1.0;
    }

    /**
     * 可选：预览音色
     */
    async previewTtsVoice(voiceId) {
        // 可以生成一句简短文本试听
        return this.generateTts('你好，这是语音测试。', voiceId);
    }
}

// 注册 Provider
registerTtsProvider(new VolcengineTtsProvider());