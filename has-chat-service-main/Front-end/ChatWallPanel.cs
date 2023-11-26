using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Erinn
{
    public sealed class ChatWallPanel : MonoBehaviour
    {
        public TMP_Text ChatOutput;
        public TMP_InputField InputField;
        public Button SendButton;

        private void Awake()
        {
            Register();
        }

        public void Register()
        {
            SendButton.onClick.AddListener(OnSendButton);
            NetworkTransport.Singleton.RegisterHandler<ChatWallResponse>(OnChatWallResponse);
            NetworkTransport.Singleton.RegisterHandler<ChatWallMessage>(OnChatWallMessage);
            return;

            void OnSendButton()
            {
                var content = InputField.text;
                if (string.IsNullOrEmpty(content))
                    return;
                NetworkTransport.Singleton.Send(new ChatWallRequest(content));
                InputField.text = "";
            }

            void OnChatWallResponse(ChatWallResponse response) => ChatOutput.text += $"\r\n{response.Error}";

            void OnChatWallMessage(ChatWallMessage message) => ChatOutput.text += $"\r\n{message.Username}: {message.Content}";
        }
    }
}