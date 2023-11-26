using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Erinn
{
    public sealed class LoginPanel : MonoBehaviour
    {
        public TMP_InputField LoginEmail;
        public TMP_InputField LoginUserpassword;
        public Button LoginButton;
        public TMP_InputField RegisterEmail;
        public TMP_InputField RegisterUsername;
        public TMP_InputField RegisterUserpassword;
        public TMP_InputField RegisterCode;
        public Button RegisterSendCodeButton;
        public Button RegisterButton;
        public GameObject Tip;
        public TMP_Text TipText;

        public GameObject ChatWall;
        
        private void Start() => Register();

        public void Register()
        {
            NetworkTransport.Singleton.RegisterHandler<LoginResponse>(OnLoginResponse);
            NetworkTransport.Singleton.RegisterHandler<RegisterEmailcodeResponse>(OnEmailcodeResponse);
            NetworkTransport.Singleton.RegisterHandler<RegisterResponse>(OnRegisterResponse);
            LoginButton.onClick.AddListener(OnLoginButton);
            RegisterSendCodeButton.onClick.AddListener(OnRegisterSendCodeButton);
            RegisterButton.onClick.AddListener(OnRegisterButton);
            return;

            void OnLoginButton()
            {
                var email = LoginEmail.text;
                if (string.IsNullOrEmpty(email))
                {
                    OnTip("邮箱不能为空");
                    return;
                }

                var userpassword = LoginUserpassword.text;
                if (string.IsNullOrEmpty(userpassword))
                {
                    OnTip("密码不能为空");
                    return;
                }

                var request = new LoginRequest(email, userpassword);
                NetworkTransport.Singleton.Send(request);
            }

            void OnRegisterSendCodeButton()
            {
                var email = RegisterEmail.text;
                if (string.IsNullOrEmpty(email))
                {
                    OnTip("邮箱不能为空");
                    return;
                }

                NetworkTransport.Singleton.Send(new RegisterEmailcodeRequest(email));
            }

            void OnRegisterButton()
            {
                var email = RegisterEmail.text;
                if (string.IsNullOrEmpty(email))
                {
                    OnTip("邮箱不能为空");
                    return;
                }

                var username = RegisterUsername.text;
                if (string.IsNullOrEmpty(username))
                {
                    OnTip("用户名不能为空");
                    return;
                }

                var userpassword = RegisterUserpassword.text;
                if (string.IsNullOrEmpty(userpassword))
                {
                    OnTip("密码不能为空");
                    return;
                }

                if (userpassword.Length is < 8 or > 15)
                {
                    OnTip("密码长度应为8到15位");
                    return;
                }

                var emailcode = RegisterCode.text;
                if (string.IsNullOrEmpty(emailcode))
                {
                    OnTip("验证码不能为空");
                    return;
                }

                NetworkTransport.Singleton.Send(new RegisterRequest(email, username, userpassword, emailcode));
            }

            void OnLoginResponse(LoginResponse response)
            {
                if (response.Success)
                {
                    ChatWall.SetActive(true);
                    gameObject.SetActive(false);
                    return;
                }
                OnTip(response.Error);
            }

            void OnEmailcodeResponse(RegisterEmailcodeResponse response) => OnTip(response.Error);

            void OnRegisterResponse(RegisterResponse response) => OnTip(response.Error);

            void OnTip(string message)
            {
                TipText.text = message;
                Tip.SetActive(true);
            }
        }
    }
}