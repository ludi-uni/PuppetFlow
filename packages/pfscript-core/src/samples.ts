/** Full sample from docs/追加仕様.md */
export const SPEC_SAMPLE_PFSCRIPT = `-- 興味に応じて笑顔

smile =
    interest * 0.4

-- 音量で口パク

mouthOpen =
    volume

-- 軽いゆらぎ

headTilt =
    noise(time * 0.2) * 0.1

-- 考え込み状態

if interest > 0.7 then

    thinking(
        intensity = 0.8
    )

end

-- 音素リップシンク

if currentPhoneme == "A" then
    MouthA = 1
end

if currentPhoneme == "I" then
    MouthI = 1
end
`;
