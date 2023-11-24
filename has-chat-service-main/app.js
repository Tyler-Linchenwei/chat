const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const mysql = require("mysql");
const nodemailer = require("nodemailer");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const { emailConfig, nowTime } = require("./config");
const {
  getUSerList,
  getUserById,
  getRandomUser,
  getUserByEmail,
  getUserByOutTradeNo,
  getOnlineUserById,
  insertUser,
  updateUserOutTradeNoById,
  updateUserOnlineStateById,
  updateHistorySessionListById,
  updateUserNoCodeById,
} = require("./query/user");
const {
  getContentBySendId,
  getUnReadContent,
  insertContent,
  updateContentReadFlagById,
} = require("./query/content");
const {
  insertCommunity,
  getCommunityList,
  getCommunityLikeRecord,
  insertCommunityLikeRecord,
  deleteCommunityLikeRecord,
  getCommunityLikeCount,
  insertCommunityComment,
  getCommunityCommentList,
  deleteCommunityComment,
  getUnreadCommunityList,
  getCommunityMessageList,
  updateCommunityContentStateById,
} = require("./query/community");
const {
  insertHistorySession,
  getHistorySession,
  getOneHistorySession,
} = require("./query/historySession");

const sessionEmail = {};

const config = require("./config");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const msg = {
  sucess: function (data, message = "") {
    return {
      code: 200,
      message,
      data,
    };
  },
  error: function (message = "") {
    return {
      code: 600,
      message,
    };
  },
};

// 生成token
function newGuid() {
  var guid = "";
  for (var i = 1; i <= 32; i++) {
    var n = Math.floor(Math.random() * 16.0).toString(16);
    guid += n;
    if (i == 8 || i == 12 || i == 16 || i == 20) guid += "-";
  }
  return guid;
}
// 随机生成验证码
function getCode(n) {
  let all = "azxcvbnmsdfghjklqwertyuiopZXCVBNMASDFGHJKLQWERTYUIOP0123456789";
  let result = "";
  for (let i = 0; i < n; i++) {
    let index = Math.floor(Math.random() * 62);
    result += all.charAt(index);
  }
  return result;
}

// 随机获取数组
function getRandArray(arr) {
  var result = {};
  arr.sort(function () {
    return 0.5 - Math.random();
  });
  result = arr[0];
  return result;
}

/**
 * 路径是否存在，不存在则创建
 * @param {string} dir 路径
 */
async function dirExists(dir) {
  let isExists = await getStat(dir);
  // 如果该路径存在且不是文件，返回 true
  if (isExists && isExists.isDirectory()) {
    return true;
  } else if (isExists) {
    // 这个路径对应一个文件夹，无法再创建文件了
    return false;
  }
  // 如果该路径不存在
  let tempDir = path.parse(dir).dir; //拿到上级路径
  // 递归判断，如果上级路径也不存在，则继续循环执行，直到存在
  let status = await dirExists(tempDir);
  let mkdirStatus;
  if (status) {
    mkdirStatus = await mkdir(dir);
  }
  return mkdirStatus;
}

/**
 * 读取路径信息
 * @param {string} filepath 路径
 */
function getStat(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        resolve(false);
      } else {
        resolve(stats);
      }
    });
  });
}

/**
 * 创建路径
 * @param {string} dir 路径
 */
function mkdir(dir) {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdir(dir, { recursive: true }, (err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } catch (error) {
      console.log("error", error);
    }
  });
}

// 根据Id获取用户信息
app.post("/api/getUserById", async function (req, res) {
  try {
    let { id } = req.body;
    let queryResult = await getUserById(id);
    if (queryResult.state) {
      res.send(msg.sucess(queryResult.data, "成功"));
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (error) {
    res.send(msg.error(error.message));
  }
});

// 获取用户列表
app.post("/api/userList", async function (req, res) {
  try {
    let { id, pageIndex, pageSize } = req.body;
    let queryResult = await getUSerList(id, pageIndex, pageSize);
    if (queryResult.state) {
      res.send(msg.sucess(queryResult.data, "成功"));
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (error) {
    res.send(msg.error(error.message));
  }
});

// 随机获取一条用户数据
app.post("/api/getRandomUser", async function (req, res) {
  try {
    let queryResult = await getRandomUser();
    if (queryResult.state) {
      res.send(msg.sucess(queryResult.data[0], "成功"));
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (error) {
    res.send(msg.error(error.message));
  }
});

// 登陆接口
app.post("/api/login", async function (req, res) {
  try {
    let { email, password } = req.body;
    let queryResult = {
      myInfo: null,
      token: "",
    };
    let result = await getUserByEmail(email);
    if (result.state) {
      if (result.data.length > 0) {
        queryResult.myInfo = result.data[0];
        if (queryResult.myInfo.Password == password) {
          queryResult.token = newGuid();
          res.send(msg.sucess(queryResult, "成功"));
        } else {
          res.send(msg.error("密码错误"));
          return;
        }
      } else {
        res.send(msg.error("该用户不存在"));
        return;
      }
    } else {
      res.send(msg.error("查询数据失败"));
      return;
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 发送邮箱验证码
app.post("/api/sendVerificationCode", async function (req, res) {
  try {
    let { email, timestamp } = req.body;
    // 校验邮箱是否被注册
    let result = await getUserByEmail(email);
    if (result.state) {
      if (result.data.length > 0) {
        res.send(msg.error("该邮箱已被注册"));
        return;
      } else {
        // 创建发送邮件的请求对象
        let transporter = nodemailer.createTransport(emailConfig);
        let verificationCode = getCode(6);
        // 邮件信息
        let mailObj = {
          from: `来自<${emailConfig.auth.user}>`, // 发送方邮箱及标题
          to: email, // 对方邮箱地址
          subject: "【haschat】账号注册", //
          html: `您正在注册haschat账号，本次请求的邮件验证码是：<b>${verificationCode}</b>（如非本人操作，请忽略该信息）`, // html格式
        };
        transporter.sendMail(mailObj, (err, info) => {
          if (err) {
            console.log("发邮件出错了", err);
            res.send(msg.sucess(null, "发邮件出错了"));
          } else {
            sessionEmail[timestamp] = verificationCode;
            res.send(msg.sucess(null, "发送验证码成功"));
            console.log("邮件发送成功");
          }
        });
      }
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 校验邮箱验证码
app.post("/api/checkVerificationCode", function (req, res) {
  try {
    let { verificationCode, timestamp } = req.body;
    if (sessionEmail[timestamp] == verificationCode) {
      delete sessionEmail[timestamp];
      res.send(msg.sucess(null, "验证码校验通过"));
    } else {
      res.send(msg.error("验证码校验失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 注册接口
app.post("/api/register", async function (req, res) {
  try {
    let { email, name, password, surePassword, avatar } = req.body;

    if (password !== surePassword) {
      res.send(msg.error("两次密码不一致"));
    }
    // 校验邮箱是否被注册
    let result = await getUserByEmail(email);
    if (result.state) {
      if (result.data.length > 0) {
        res.send(msg.error("该邮箱已被注册"));
        return;
      }
      // 新增用户
      let obj = {
        name: name,
        nickName: name,
        email: email,
        password: password,
        avatar: avatar || config.newUserConfig.Avatar,
      };
      let result2 = await insertUser(obj);
      if (result2.state) {
        res.send(msg.sucess(null, "注册成功"));
      } else {
        res.send(msg.error("注册失败"));
      }
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 上传文件接口
app.post(
  "/api/uploadFile",
  multer({
    dest: "upload",
  }).array("file", 1),
  (req, res) => {
    const files = req.files;
    const fileList = [];
    for (let i in files) {
      let file = files[i];
      fs.renameSync(file.path, `upload/${file.filename}${file.originalname}`);
      file.path = `upload/${file.filename}${file.originalname}`;
      fileList.push(file);
    }
    res.send(fileList);
  }
);

// 上传图片接口
app.post(
  "/api/uploadImage",
  multer({
    dest: "upload",
  }).array("file", 1),
  async (req, res) => {
    const files = req.files;
    const fileList = [];
    await dirExists("upload/img/");
    for (let i in files) {
      let file = files[i];
      fs.renameSync(
        file.path,
        `upload/img/${file.filename}${file.originalname}`
      );
      file.path = `upload/img/${file.filename}${file.originalname}`;
      fileList.push(file);
    }
    res.send(fileList);
  }
);

// 获取资源文件
app.get("/api/getFile", (req, res) => {
  req.query.url
    ? res.download(`upload/${req.query.url}`)
    : res.send(msg.error("获取数据失败"));
});

// 获取图片资源文件
app.get("/api/getImage", (req, res) => {
  req.query.url
    ? res.download(req.query.url)
    : res.send(msg.error("获取数据失败"));
});

// 发布社区
app.post("/api/publishComunity", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.PublishId > 0)) {
      res.send(msg.error("请登陆后再发布"));
      return;
    }
    if (!model.Content) {
      res.send(msg.error("内容不得为空"));
      return;
    }
    model.CreateDateUtc = nowTime();

    let result2 = await insertCommunity(model);
    if (result2.state) {
      res.send(msg.sucess(null, "发布成功"));
    } else {
      res.send(msg.error("发布失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 获取社区内容
app.post("/api/getCommunityList", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.pageIndex > 0 && model.pageSize > 0)) {
      res.send(msg.error("参数必须大于零"));
      return;
    }
    let result = await getCommunityList(model);
    if (result.state) {
      let queryData = result.data;
      for (let i = 0, len = queryData.length; i < len; i++) {
        queryData[i].ImgList = JSON.parse(queryData[i].ImgList);
        let result2 = await getCommunityLikeRecord({
          userId: model.userId,
          communityId: queryData[i].Id,
        });
        if (result2.state) {
          queryData[i].IsLike = result2.data?.length > 0 ? true : false;
        }
        let result3 = await getCommunityLikeCount({
          communityId: queryData[i].Id,
        });
        queryData[i].LikeNum = result3.data.length;
        let result4 = await getCommunityCommentList({
          communityId: queryData[i].Id,
        });
        queryData[i].CommentList = result4.data;
      }
      res.send(msg.sucess(queryData, "查询成功"));
    } else {
      res.send(msg.error("查询失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 新增社区喜爱
app.post("/api/insertCommunityLikeRecord", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.userId > 0 && model.communityId > 0)) {
      res.send(msg.error("缺乏必要参数"));
      return;
    }
    let result = await getCommunityLikeRecord(model);
    if (result.state) {
      if (result.data.length == 0) {
        let result2 = await insertCommunityLikeRecord(model);
        if (result2.state) {
          let result3 = await getCommunityLikeCount({
            communityId: model.communityId,
          });
          let count = result3.state ? result3.data.length : -1;
          res.send(msg.sucess(count, "点赞成功"));
        } else {
          res.send(msg.error("点赞异常"));
        }
      } else {
        res.send(msg.sucess(null, "点赞成功"));
      }
    } else {
      res.send(msg.error("点赞失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 删除社区喜爱
app.post("/api/deleteCommunityLikeRecord", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.userId > 0 && model.communityId > 0)) {
      res.send(msg.error("缺乏必要参数"));
      return;
    }
    let result = await deleteCommunityLikeRecord(model);
    if (result.state) {
      let result2 = await getCommunityLikeCount({
        communityId: model.communityId,
      });
      let count = result2.state ? result2.data.length : -1;
      res.send(msg.sucess(count, "取消成功"));
    } else {
      res.send(msg.error("取消失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 新增社区评论
app.post("/api/insertCommunityComment", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.sendId > 0)) {
      res.send(msg.error("请登陆后再发布"));
      return;
    }
    if (!(model.communityId > 0)) {
      res.send(msg.error("社区Id不得为空"));
      return;
    }
    if (!model.content) {
      res.send(msg.error("内容不得为空"));
      return;
    }
    model.createDateUtc = nowTime();

    let result = await insertCommunityComment(model);
    if (result.state) {
      res.send(msg.sucess(null, "评论成功"));
    } else {
      res.send(msg.error("评论失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 获取社区评论
app.post("/api/getCommunityCommentList", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.communityId > 0)) {
      res.send(msg.error("社区Id不得为空"));
      return;
    }
    let result = await getCommunityCommentList(model);
    if (result.state) {
      res.send(msg.sucess(result.data, "查询成功"));
    } else {
      res.send(msg.error("查询失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 删除社区评论
app.post("/api/deleteCommunityComment", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.id > 0)) {
      res.send(msg.error("缺乏必要参数"));
      return;
    }
    let result = await deleteCommunityComment(model);
    if (result.state) {
      res.send(msg.sucess(null, "删除成功"));
    } else {
      res.send(msg.error("删除失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 获取用户未读信息
app.post("/api/getUnreadCommunityList", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.receiverId > 0)) {
      res.send(msg.error("Id不得为空"));
      return;
    }
    let result = await getUnreadCommunityList(model);
    if (result.state) {
      res.send(msg.sucess(result.data, "查询成功"));
    } else {
      res.send(msg.error("查询失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 获取用户评论消息
app.post("/api/getCommunityMessageList", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.receiverId > 0)) {
      res.send(msg.error("Id不得为空"));
      return;
    }
    let result = await getCommunityMessageList(model);
    if (result.state) {
      res.send(msg.sucess(result.data, "查询成功"));
    } else {
      res.send(msg.error("查询失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 更新用户的消息阅读状态
app.post("/api/updateCommunityContentStateById", async function (req, res) {
  try {
    let model = req.body;
    if (!(model.receiverId > 0)) {
      res.send(msg.error("Id不得为空"));
      return;
    }
    let result = await updateCommunityContentStateById(model);
    if (result.state) {
      res.send(msg.sucess(result.data, "更新成功"));
    } else {
      res.send(msg.error("更新失败"));
    }
  } catch (err) {
    res.send(msg.error(err.message));
  }
});

// 迁移历史会话
// app.post('/api/changeHistorySession', async function (req, res) {
//   try {
//     let queryResult = await getUSerList(99999);
//     if (queryResult.state) {
//       if (queryResult.data.length > 0) {
//         queryResult.data.forEach(x => {
//           let historySessionList = [];
//           if (x.HistorySessionList != null) {
//             historySessionList = JSON.parse(x.HistorySessionList)
//           }
//           historySessionList.forEach(async obj => {
//             let historySession = {
//               FormId: obj.Id,
//               Name: obj.Name,
//               NickName: obj.NickName,
//               PersonalitySign: obj.PersonalitySign,
//               Mobile: obj.Mobile,
//               Region: obj.Region,
//               Avatar: obj.Avatar,
//               Email: obj.Email,
//               ById: x.Id,
//             };
//             let result2 = await insertHistorySession(historySession);
//           })
//         })
//       }
//       res.send(msg.sucess({}, '成功'))
//     } else {
//       res.send(msg.error("新增数据失败"))
//     }
//   } catch (err) {
//     res.send(msg.error(err.message))
//   }
// })

// 获取历史会话列表
app.post("/api/getHistorySessionById", async function (req, res) {
  let { id, pageIndex, pageSize } = req.body;
  let queryResult = await getHistorySession(id, pageIndex, pageSize);
  if (queryResult.state) {
    res.send(msg.sucess(queryResult.data, "成功"));
  } else {
    res.send(msg.error("获取数据失败"));
  }
});

// 获取历史会话列表
app.post("/api/insertHistorySession", async function (req, res) {
  try {
    let params = req.body;
    let queryResult = await getOneHistorySession(params.byId, params.formId);
    if (queryResult.state && queryResult.data.length == 0) {
      let historySession = {
        FormId: params.formId,
        Name: params.name,
        NickName: params.nickName,
        PersonalitySign: params.personalitySign || null,
        Mobile: params.mobile || null,
        Region: params.region || null,
        Avatar: params.avatar,
        Email: params.email,
        ById: params.byId,
      };
      await insertHistorySession(historySession);
    }
    res.send(msg.sucess({}, "成功"));
  } catch (error) {
    res.send(msg.error(error.message));
  }
});

// 获取会话内容
app.post("/api/getContentBySendId", async function (req, res) {
  try {
    let { id, pageIndex, pageSize } = req.body;
    let queryResult = await getContentBySendId(id, pageIndex, pageSize);
    if (queryResult.state) {
      res.send(msg.sucess(queryResult.data, "成功"));
    } else {
      res.send(msg.error("获取数据失败"));
    }
  } catch (error) {
    res.send(msg.error(error.message));
  }
});

const server = app.listen(9527, function () {
  console.log("server running on port 9527");
});

const io = socket(server, {
  cors: {
    origin: "*",
  },
});

// 事件
io.on("connection", function (socket) {
  // 加入聊天
  socket.on("joinChat", async (data) => {
    try {
      //若该用户已登陆，将旧设备登陆的用户强制下线
      let queryResult = await getUserById(data.SendId);
      if (
        queryResult.state &&
        queryResult.data.length > 0 &&
        queryResult.data[0].OnlineState
      ) {
        socket.to(queryResult.data[0].OutTradeNo).emit("squeezeOut", {
          noCode: queryResult.data[0].NoCode,
        });
      }
      let queryResult2 = await updateUserOutTradeNoById(data.SendId, socket.id);
      queryResult2 = await updateUserOnlineStateById(data.SendId, true);
      queryResult2 = await updateUserNoCodeById(data.SendId, data.NoCode);
      socket.emit("joinSuccess", {});
    } catch (err) {
      console.log(err.message);
    }
  });

  //发送消息
  socket.on("sendMsg", async (data) => {
    try {
      let queryResult = await getUserById(data.Conversition.ReciverId);
      if (!queryResult.state) {
        console.log("获取数据失败");
        return;
      }
      let reciver = queryResult.data;
      data.Conversition.State = 1; // 设置发送状态为成功
      data.Conversition.CreateDateUtc = nowTime();
      let result = await insertContent(data.Conversition); // 在数据库中先插入聊天内容
      if (reciver.length > 0) {
        socket.to(reciver[0].OutTradeNo).emit("reviceMsg", data.Conversition); // 推送
      }
      socket.emit("changMsgState", data.Conversition);

      // 将发送者的会话存储到接收者的历史会话中
      let queryResult2 = await getOneHistorySession(
        data.ReciverId,
        data.Sender.Id
      );
      if (queryResult2.state && queryResult2.data.length == 0) {
        let historySession = {
          FormId: data.Sender.Id,
          Name: data.Sender.Name,
          NickName: data.Sender.NickName,
          PersonalitySign: data.Sender.PersonalitySign || null,
          Mobile: data.Sender.Mobile || null,
          Region: data.Sender.Region || null,
          Avatar: data.Sender.Avatar,
          Email: data.Sender.Email,
          ById: data.ReciverId,
        };
        await insertHistorySession(historySession);
      }

      // if (reciver[0].HistorySessionList != null) {
      //   let historySessionList = JSON.parse(reciver[0].HistorySessionList);
      //   let len = historySessionList.filter((x) => x.Id == data.Sender.Id)?.length ?? 0;
      //   if (len === 0) {
      //     data.Sender.HistorySessionList = "";
      //     historySessionList.push(data.Sender);
      //     updateHistorySessionListById(JSON.stringify(historySessionList), reciver[0].Id);
      //   }
      // } else {
      //   let historySessionList = [];
      //   data.Sender.HistorySessionList = "";
      //   historySessionList.push(data.Sender);
      //   updateHistorySessionListById(JSON.stringify(historySessionList), reciver[0].Id);
      // }
    } catch (err) {
      console.log(err.message);
    }
  });

  //修改信息阅读状态
  socket.on("changeMsgRead", async (data) => {
    try {
      let queryResult = await getUnReadContent(data.SendId, data.ReciverId);
      if (queryResult.state && queryResult.data.length > 0) {
        queryResult.data.map((x) => {
          updateContentReadFlagById(x.Id);
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  });

  socket.on("disconnect", async () => {
    let queryResult = await getUserByOutTradeNo(socket.id);
    if (queryResult.state && queryResult.data.length > 0) {
      updateUserOnlineStateById(queryResult.data[0].Id, false);
    }
  });
});
